from django.db.models import Sum, Value, DecimalField, Q, Max, Count
from rest_framework import viewsets
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter,SearchFilter
from sales_purchases.models import Sale
from .models import Customer, Interaction
from .serializers import CustomerSerializer, InteractionSerializer,CustomerTransactionHistorySerializer
from .permissions import HasActiveSubscription,IsOwnerOrEmployee,IsBusinessAdmin
from .utils import export_customer_history
from .pagination import CustomerPagination
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.filters import OrderingFilter, SearchFilter



class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription, IsOwnerOrEmployee]
    filter_backends = [OrderingFilter, SearchFilter]
    search_fields = ['name', 'created_at']
    ordering_fields = ['name', 'created_at', 'products_count', 'address', 'latest_sale', 'balance']
    pagination_class = CustomerPagination

    def get_queryset(self):
        user = self.request.user

        qs = Customer.objects.select_related("company")
        if user.role != "super_admin":
            qs = qs.filter(company=user.company)
        return qs.annotate(
            products_count=Count('sales__item', distinct=True),
            balance=Coalesce(Sum('sales__total'), Value(0, output_field=DecimalField())),
            latest_sale=Max('sales__date')
        )

    def retrieve(self, request, pk=None):
        user = request.user

        customer = get_object_or_404(self.get_queryset(), pk=pk)

        if user.role != "super_admin" and customer.company != user.company:
            return Response({"detail": "Not allowed"}, status=403)

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")  
        export_type = request.query_params.get("export")

        sales_queryset = Sale.objects.select_related("item") \
            .prefetch_related("transactions") \
            .filter(customer=customer)

        if user.role != "super_admin":
            sales_queryset = sales_queryset.filter(company=user.company)

        if search:
            sales_queryset = sales_queryset.filter(
                Q(item__name__icontains=search) |
                Q(item__code__icontains=search)
            )

        if ordering:
            # Split by comma for multi-field support
            ordering_fields = [field.strip() for field in ordering.split(',')]
            # Validate against allowed fields to prevent arbitrary sorting
            allowed_fields = ['date', 'quantity', 'unit_price', 'total', 'status', 'item__code']
            valid_ordering = [f for f in ordering_fields if f.lstrip('-') in allowed_fields]
            if valid_ordering:
                sales_queryset = sales_queryset.order_by(*valid_ordering)
            else:
                sales_queryset = sales_queryset.order_by("-date")
        else:
            sales_queryset = sales_queryset.order_by("-date")

        page = self.paginate_queryset(sales_queryset)
        if page is not None:
            serializer = CustomerTransactionHistorySerializer(page, many=True)
            if export_type:
                response = export_customer_history(
                    export_type,
                    CustomerTransactionHistorySerializer(sales_queryset, many=True).data,
                    customer.id
                )
                if response:
                    return response
                return Response(
                    {"detail": "Invalid export type. Use 'csv' or 'pdf'."},
                    status=400
                )

            return self.get_paginated_response(serializer.data)

        serializer = CustomerTransactionHistorySerializer(
            sales_queryset,
            many=True
        )
        if export_type:
            response = export_customer_history(
                export_type,
                serializer.data,
                customer.id
            )

            if response:
                return response

            return Response(
                {"detail": "Invalid export type. Use 'csv' or 'pdf'."},
                status=400
            )

        return Response(serializer.data)
    
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
    
    