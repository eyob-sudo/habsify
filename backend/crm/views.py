from rest_framework import viewsets, generics
from rest_framework.permissions import IsAuthenticated
from .models import Customer, Interaction
from .serializers import CustomerSerializer, InteractionSerializer
from .permissions import HasActiveSubscription,IsOwnerOrEmployee

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated,HasActiveSubscription,IsOwnerOrEmployee]

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
    # Employee limit: Read-only for employees
    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'DELETE']:
            if self.request.user.role == 'employee':
                return [IsBusinessAdmin()]
        return super().get_permissions()
    
    