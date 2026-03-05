from django.utils import timezone
from rest_framework.response import Response
from rest_framework import viewsets,mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.parsers import MultiPartParser, FormParser
from .models import SubscriptionPlan,Subscription,Payment,PaymentMethod,BankAccount
from crm.permissions import HasActiveSubscription 
from .permissions import IsOwnerOrAdmin,HasValidSubscription
from .throttles import SubscriptionGlobalThrottle,SubscribeAndPayThrottle
from .serializers import (SubscriptionPlanSerializer,
                          SubscriptionSerializer,
                          FreeTrialSerializer,
                          PayNowSerializer,
                          PaymentMethodSerializer,
                          BankAccountSerializer)

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]

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

    @action(detail=False, methods=['post'], serializer_class=FreeTrialSerializer)
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