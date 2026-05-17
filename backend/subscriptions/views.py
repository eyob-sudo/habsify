from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets,mixins,generics
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.decorators import action
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .models import Feature, SubscriptionPlan,Subscription,Payment,PaymentMethod,BankAccount
from crm.permissions import HasActiveSubscription 
from .permissions import IsOwnerOrAdmin,HasValidSubscription
from .throttles import SubscriptionGlobalThrottle,SubscribeAndPayThrottle
from .serializers import (SubscriptionPlanSerializer,
                          SubscriptionSerializer,
                          FreeTrialSerializer,
                          PayNowSerializer,
                          PaymentMethodSerializer,
                          BankAccountSerializer,
                          AccessStatusSerializer)


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SubscriptionPlanSerializer
    queryset = SubscriptionPlan.objects.prefetch_related('features')
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        company_id = request.user.company.id if request.user.is_authenticated else "public"
        
        cache_key = f"subscription_plans_{company_id}"


        if data is None:
            # First time or cache expired
            plans = list(self.get_queryset())

            all_features = list(Feature.objects.all().order_by('id'))  # added order_by for consistency

            plan_features_map = {}
            for plan in plans:
                plan_features_map[plan.id] = {f.id for f in plan.features.all()}

            serializer = self.get_serializer(
                plans, 
                many=True, 
                context={
                    'request': request,
                    'all_features': all_features,
                    'plan_features_map': plan_features_map
                }
            )
            data = serializer.data

            # Cache for 10 minutes
            cache.set(cache_key, data, timeout=600)

        return Response(data)
    

class SubscriptionViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          viewsets.GenericViewSet):
    
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated,IsOwnerOrAdmin]
    lookup_field = 'uid'
    # throttle_classes = [SubscriptionGlobalThrottle]

    def get_queryset(self):
        if self.request.user.is_staff:
            return super().get_queryset()
        return Subscription.objects.filter(company=self.request.user.company)

    @method_decorator(csrf_exempt, name='dispatch')
    @action(detail=False, methods=['post'], serializer_class=FreeTrialSerializer,permission_classes=[AllowAny])
    def free_trial(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = serializer.save()
        return Response(SubscriptionSerializer(subscription).data, status=201)

    @action(detail=False, methods=['post'],
            serializer_class=PayNowSerializer,
            parser_classes=(MultiPartParser,FormParser, JSONParser),
            # throttle_classes=[SubscribeAndPayThrottle]
            )
    def subscribe_and_pay(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = serializer.save()
        return Response({
            "subscription_uid": subscription.uid,
            "status": "pending_payment",
            "message": "Payment submitted. Please wait up to 24 hours for manual approval."
        }, status=201)
    
    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrAdmin])
    def cancel(self, request, uid=None):
        subscription = self.get_object()

        # Prevent cancelling if already done
        if subscription.status in ['cancelled', 'expired']:
            return Response({
                "error": "This subscription is already cancelled or expired."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Cancel logic
        subscription.status = 'cancelled'
        subscription.active = False
        subscription.end_date = timezone.now().date()
        subscription.save()

        return Response({
            "status": "cancelled",
            "message": "Your subscription has been successfully cancelled."
        }, status=status.HTTP_200_OK)
    
class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

class BankAccountViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BankAccount.objects.filter(is_active=True)
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]


class AccessStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        company = user.company
        subscription = getattr(company, "subscription", None)

        if not subscription:
            data = {
                "company_name": company.name,
                "subscription_status": "NO_PLAN",
                "user_role": user.role,
                "can_enter_app": False,
                "read_only": False,
                "action_required": "CHOOSE_PLAN",
            }
        else:
            # Active/trialing are full access
            is_active = subscription.status in {
                Subscription.STATUS_ACTIVE,
                Subscription.STATUS_TRIALING,
            }

            data = {
                "company_name": company.name,
                "subscription_status": subscription.status,
                "days_remaining": subscription.days_remaining,
                "user_role": user.role,
                "can_enter_app": True,
                "read_only": not is_active,
                "action_required": None if is_active else "RENEW_SUBSCRIPTION",
            }

        return Response(AccessStatusSerializer(data).data)