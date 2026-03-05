from rest_framework import viewsets,mixins
from django.db.models import Sum, Value, DecimalField, IntegerField, Q, Max, Count, F, ExpressionWrapper
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from crm.permissions import IsBusinessAdmin
from crm.permissions import HasActiveSubscription
from .models import Item, Category, StockMovement, Warehouse
from django.db.models import Prefetch
from inventory.models import Inventory
from .serializers import (
    WarehouseOverviewSerializer,
    WarehouseInventorySerializer,
    WarehouseCreateSerializer,
    ItemSerializer,CategorySerializer,
    StockMovement,
    StockMovementCreateUpdateSerializer,
    StockMovementDetailSerializer,
    StockMovementListSerializer,
    InventoryDropdownSerializer
)
from .models import Warehouse, Item
from .pagination import StandardPagination  

class WarehouseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasActiveSubscription, IsBusinessAdmin]
    filter_backends = [OrderingFilter, SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'address']                  
    ordering_fields = ['name', 'created_at', 'current_stock', 'total_worth', 'address', 'item_count']
    filterset_fields = ['name']
    pagination_class = StandardPagination 

    def get_serializer_class(self):
        if self.action == 'list':
            return WarehouseOverviewSerializer
        if self.action == 'retrieve':
            return WarehouseInventorySerializer
        return WarehouseCreateSerializer

    def get_queryset(self):
        inventory_qs = Inventory.objects.filter(
            company=self.request.user.company
        ).select_related('item', 'item__category')   

        inventory_search = self.request.query_params.get("inventory_search")
        if inventory_search:
            inventory_qs = inventory_qs.filter(
                item__name__icontains=inventory_search
            )

        category = self.request.query_params.get("category")
        if category:
            inventory_qs = inventory_qs.filter(
                item__category__name__iexact=category
            )

        return Warehouse.objects.filter(
            company=self.request.user.company
        ).annotate(
            current_stock=Coalesce(
                Sum("inventories__current_stock"),
                Value(0, output_field=IntegerField())
            ),
            total_worth=Coalesce(
                Sum(
                    ExpressionWrapper(
                        F('inventories__current_stock') * F('inventories__item__unit_price'),
                        output_field=DecimalField()
                    )
                ),
                Value(0, output_field=DecimalField())
            ),
            item_count=Count('inventories', distinct=True)
        ).prefetch_related(
            Prefetch("inventories", queryset=inventory_qs)
        )

    def retrieve(self, request, *args, **kwargs):
        """Return flat list of products for this warehouse with enhanced ordering and pagination"""
        warehouse = self.get_object()                     
        ordering = request.query_params.get("inventory_ordering")
        
        inventories_queryset = warehouse.inventories.all().select_related('item', 'item__category')

        if ordering:
            # Split by comma for multi-field support
            ordering_fields = [field.strip() for field in ordering.split(',')]
            # Validate against allowed fields to prevent arbitrary sorting
            allowed_fields = ['current_stock', 'item__name', 'item__category__name', 'item__unit_price', 'worth']
            valid_ordering = []
            for f in ordering_fields:
                field = f.lstrip('-')
                if field in allowed_fields:
                    if field == 'worth':
                        # Annotate worth for ordering
                        inventories_queryset = inventories_queryset.annotate(
                            worth=ExpressionWrapper(
                                F('current_stock') * F('item__unit_price'),
                                output_field=DecimalField()
                            )
                        )
                        valid_ordering.append(f.replace('worth', 'worth')) 
                    elif field == 'item__category__name':
                        valid_ordering.append(f.replace('item__category__name', 'item__category__name'))
                    else:
                        valid_ordering.append(f)
            if valid_ordering:
                inventories_queryset = inventories_queryset.order_by(*valid_ordering)

        # Apply pagination
        page = self.paginate_queryset(inventories_queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(inventories_queryset, many=True)
        return Response(serializer.data)
    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class ItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category__name']
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code', 'unit_price', 'created_at', 'category__name', 'unit_measure']
    pagination_class = StandardPagination 

    def get_queryset(self):
        user = self.request.user
        qs = Item.objects.select_related('category')
        if user.role != "super_admin":
            qs = qs.filter(company=user.company)
        return qs.all()

    def get_serializer_class(self):
        return ItemSerializer

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    pagination_class = StandardPagination 
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['name']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at', 'item_count','updated_at']

    def get_queryset(self):
        if self.request.user.role == 'super_admin':
            qs = Category.objects.all()
        else:
            qs = Category.objects.filter(company=self.request.user.company)
        return qs.annotate(
            item_count=Count('items')  
        )

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class StockMovementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    http_method_names = ["get", "post"]
    filterset_fields = ['movement_type', 'inventory__id', 'date']
    search_fields = ['notes', 'inventory__item__name', 'movement_type']
    ordering_fields = [
        'date',
        'movement_type',
        'quantity',
        'inventory__warehouse__name',
        'notes'
    ]

    pagination_class = StandardPagination

    def get_queryset(self):
        qs = StockMovement.objects.select_related(
            "inventory__company",
            "inventory__warehouse",
            "inventory__item",
            "purchase",
            "sale",
        )

        user = self.request.user
        company = getattr(user, "company", None)

        # Filter by company if not super_admin
        if user.role != "super_admin" and company:
            qs = qs.filter(inventory__company=company)

        # Optional extra search (your manual override — still safe)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(notes__icontains=search) |
                Q(inventory__item__name__icontains=search) |
                Q(movement_type__icontains=search)
            )

        return qs.order_by("-date")

    def get_serializer_class(self):
        if self.action == "list":
            return StockMovementListSerializer

        if self.action == "retrieve":
            return StockMovementDetailSerializer

        return StockMovementCreateUpdateSerializer


class InventoryDropdownViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = InventoryDropdownSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Inventory.objects.select_related(
            "item",
            "warehouse",
            "company",
        )

        user = self.request.user
        company = getattr(user, "company", None)

        if user.role != "super_admin" and company:
            qs = qs.filter(company=company)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(item__name__icontains=search) |
                Q(warehouse__name__icontains=search)
            )

        return qs.order_by("item__name")