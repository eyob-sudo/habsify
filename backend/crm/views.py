from django.db.models import Prefetch,Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter,SearchFilter
from sales_purchases.models import Sale
from .models import Customer, Interaction
from .serializers import CustomerSerializer, InteractionSerializer
from .permissions import HasActiveSubscription,IsOwnerOrEmployee,IsBusinessAdmin

from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.filters import OrderingFilter, SearchFilter

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription, IsOwnerOrEmployee]
    filter_backends = [OrderingFilter, SearchFilter]
    search_fields = ['name', 'created_at']
    ordering_fields = ['created_at']

    def get_queryset(self):
        user = self.request.user
        search = self.request.query_params.get('search_sales')
        ordering = self.request.query_params.get("sales_ordering")

        allowed_ordering = ["date", "-date"]

        # Start with Sale queryset
        sales_queryset = Sale.objects.select_related("item") \
            .prefetch_related("transactions")

        # Filter by company (multi-tenant safety)
        if user.role != "super_admin":
            sales_queryset = sales_queryset.filter(company=user.company)

        # Apply search
        if search:
            sales_queryset = sales_queryset.filter(
                Q(item__name__icontains=search) |
                Q(item__code__icontains=search)
            )

        # Apply ordering safely
        if ordering in allowed_ordering:
            sales_queryset = sales_queryset.order_by(ordering)
        else:
            sales_queryset = sales_queryset.order_by("-date")

        # Wrap in Prefetch
        sales_prefetch = Prefetch(
            "sales",
            queryset=sales_queryset
        )

        # Base queryset
        base_queryset = Customer.objects.select_related("company").prefetch_related(
            sales_prefetch
        )

        if user.role == "super_admin":
            return base_queryset

        return base_queryset.filter(company=user.company)

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
    
    