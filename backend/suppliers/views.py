from rest_framework import viewsets
from rest_framework.filters import OrderingFilter,SearchFilter
from rest_framework.permissions import IsAuthenticated
from crm.permissions import HasActiveSubscription,IsBusinessAdmin
from .models import Supplier
from .serializers import SupplierSerializer

class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated,HasActiveSubscription,IsBusinessAdmin]
    filter_backends = [OrderingFilter,SearchFilter]
    search_fields = ['name','created_at']
    ordering_fields = ['created_at'] 

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Supplier.objects.select_related('company').all()
        
        return Supplier.objects.select_related('company')\
            .filter(company=user.company)


    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company, created_by=self.request.user)
