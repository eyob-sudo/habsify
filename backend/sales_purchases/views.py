from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework import serializers
from crm.permissions import HasActiveSubscription
from .models import Sale, Purchase
from .serializers import SaleSerializer, PurchaseSerializer

class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]

    def get_queryset(self):
        qs = Sale.objects.select_related('company')
        user_company = getattr(self.request.user, 'company', None)
        if self.request.user.role != 'super_admin' and user_company is not None:
            qs = qs.filter(company=user_company)
        return qs

    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'company') or not self.request.user.company:
            raise serializers.ValidationError("User must have an associated company.")
        serializer.save(company=self.request.user.company)


class PurchaseViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]

    def get_queryset(self):
        qs = Purchase.objects.select_related('company')
        user_company = getattr(self.request.user, 'company', None)
        if self.request.user.role != 'super_admin' and user_company is not None:
            qs = qs.filter(company=user_company)
        return qs

    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'company') or not self.request.user.company:
            raise serializers.ValidationError("User must have an associated company.")
        serializer.save(company=self.request.user.company)