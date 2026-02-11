from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import viewsets,mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.parsers import MultiPartParser, FormParser
from .models import SubscriptionPlan,Subscription,Payment,PaymentMethod,BankAccount
from .permissions import IsOwnerOrAdmin,HasValidSubscription
from .serializers import (SubscriptionPlanSerializer,
                          SubscriptionSerializer,
                          FreeTrialSerializer,
                          PayNowSerializer)

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]



    # @action(detail=True, methods=['post'])
    # def cancel(self, request, uid=None):
    #     sub = self.get_object()
    #     sub.active = False
    #     sub.save()
    #     return Response({'status': 'cancelled'})
    
class SubscriptionViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          viewsets.GenericViewSet):
    
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated,IsOwnerOrAdmin]
    lookup_field = 'uid'

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

    @action(detail=False, methods=['post'],serializer_class=PayNowSerializer,parser_classes=(MultiPartParser, FormParser, JSONParser))
    def subscribe_and_pay(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = serializer.save()
        return Response({
            "subscription_uid": subscription.uid,
            "status": "pending_payment",
            "message": "Payment submitted. Please wait up to 24 hours for manual approval."
        }, status=201)
