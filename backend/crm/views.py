from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter,SearchFilter
from .models import Customer, Interaction
from .serializers import CustomerSerializer, InteractionSerializer
from .permissions import HasActiveSubscription,IsOwnerOrEmployee,IsBusinessAdmin

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated,HasActiveSubscription,IsOwnerOrEmployee]
    filter_backends = [OrderingFilter,SearchFilter]
    search_fields = ['name','created_at']
    ordering_fields = ['created_at'] 

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Customer.objects.select_related('company').all()
        
        return Customer.objects.select_related('company')\
            .filter(company=user.company)


    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class InteractionViewSet(viewsets.ModelViewSet):
    queryset = Interaction.objects.all()
    serializer_class = InteractionSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]

    def get_queryset(self):
        if self.request.user.role == 'super_admin':
            return self.queryset.all()
        return self.queryset.filter(customer__company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(customer=self.customer, created_by=self.request.user)
    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'DELETE']:
            if self.request.user.role == 'employee':
                return [IsBusinessAdmin()]
        return super().get_permissions()
    
    