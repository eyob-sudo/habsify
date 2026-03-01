from django.db.models import Sum, Value, DecimalField, IntegerField, Q, Max
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from django.shortcuts import get_object_or_404
from .models import Supplier
from .serializers import SupplierListSerializer, SupplierHistorySerializer
from .pagination import SupplierPagination
from sales_purchases.models import Purchase
from crm.permissions import IsBusinessAdmin, HasActiveSubscription
from .utils import export_supplier_history

class SupplierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsBusinessAdmin, HasActiveSubscription]
    filter_backends = [OrderingFilter, SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'address']
    ordering_fields = ['name', 'created_at', 'balance', 'products', 'address', 'latest_purchase']
    filterset_fields = ['name']
    pagination_class = SupplierPagination

    def get_queryset(self):
        user = self.request.user
        qs = Supplier.objects.all()
        if user.role != "super_admin":
            qs = qs.filter(company=user.company)
        return qs.annotate(
            products=Coalesce(Sum('purchase__quantity'), Value(0, output_field=IntegerField())),
            balance=Coalesce(Sum('purchase__total'), Value(0, output_field=DecimalField())),
            latest_purchase=Max('purchase__date')
        )

    def get_serializer_class(self):
        return SupplierListSerializer

    def retrieve(self, request, pk=None):
        user = request.user
        supplier = get_object_or_404(self.get_queryset(), pk=pk)
        if user.role != "super_admin" and supplier.company != user.company:
            return Response({"detail": "Not allowed"}, status=403)
        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        export_type = request.query_params.get("export")

        purchases_queryset = Purchase.objects.filter(
            supplier=supplier
        )
        if user.role != "super_admin":
            purchases_queryset = purchases_queryset.filter(company=user.company)
        if search:
            purchases_queryset = purchases_queryset.filter(
                Q(item__name__icontains=search) |
                Q(item__code__icontains=search)
            )

        # Apply ordering using Django's order_by (supports multiples and prefixes)
        if ordering:
            # Split by comma for multi-field support
            ordering_fields = [field.strip() for field in ordering.split(',')]
            # Validate against allowed fields to prevent arbitrary sorting
            allowed_fields = ['date', 'quantity', 'unit_price', 'total', 'status', 'item__code']
            valid_ordering = [f for f in ordering_fields if f.lstrip('-') in allowed_fields]
            if valid_ordering:
                purchases_queryset = purchases_queryset.order_by(*valid_ordering)
            else:
                purchases_queryset = purchases_queryset.order_by("-date")
        else:
            purchases_queryset = purchases_queryset.order_by("-date")

        page = self.paginate_queryset(purchases_queryset)
        if page is not None:
            serializer = SupplierHistorySerializer(page, many=True)
            if export_type:
                response = export_supplier_history(
                    export_type,
                    SupplierHistorySerializer(purchases_queryset, many=True).data,
                    pk
                )
                if response:
                    return response
                return Response(
                    {"detail": "Invalid export type. Use 'csv' or 'pdf'."},
                    status=400
                )
            return self.get_paginated_response(serializer.data)
        serializer = SupplierHistorySerializer(purchases_queryset, many=True)
        if export_type:
            response = export_supplier_history(
                export_type,
                serializer.data,
                pk
            )
            if response:
                return response
            return Response(
                {"detail": "Invalid export type. Use 'csv' or 'pdf'."},
                status=400
            )
        return Response(serializer.data)

    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'company') or not self.request.user.company:
            raise ValidationError("User must have an associated company.")
        serializer.save(company=self.request.user.company)