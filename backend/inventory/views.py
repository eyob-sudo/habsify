from rest_framework import viewsets,mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from crm.permissions import IsBusinessAdmin
from crm.permissions import HasActiveSubscription
from .models import Item, Category, StockMovement, Warehouse
from django.db.models import Prefetch
from inventory.models import Inventory
from .serializers import (
    WarehouseOverviewSerializer,
    WarehouseDetailSerializer,
    WarehouseCreateSerializer,
    ItemSerializer,CategorySerializer,
    StockMovementSerializer
)
from .models import Warehouse, Item


class WarehouseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasActiveSubscription, IsBusinessAdmin]
    filter_backends = [OrderingFilter, SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'address']
    ordering_fields = ['name', 'created_at','current_stock']
    filterset_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return WarehouseOverviewSerializer
        if self.action == 'retrieve':
            return WarehouseDetailSerializer
        return WarehouseCreateSerializer

    def get_queryset(self):
        inventory_qs = Inventory.objects.filter(
            company=self.request.user.company
        )

        # Search
        search = self.request.query_params.get("inventory_search")
        if search:
            inventory_qs = inventory_qs.filter(
                item__name__icontains=search
            )

        # Category
        category = self.request.query_params.get("category")
        if category:
            inventory_qs = inventory_qs.filter(
                item__category__name__iexact=category
            )

        # Sorting
        allowed_ordering = ["current_stock", "-current_stock","item"]
        ordering = self.request.query_params.get("inventory_ordering")
        if ordering in allowed_ordering:
            inventory_qs = inventory_qs.order_by(ordering)

        return Warehouse.objects.filter(
            company=self.request.user.company
        ).annotate(
            current_stock=Coalesce(
                Sum("inventories__current_stock"),
                Value(0)
            )
        ).prefetch_related(
            Prefetch("inventories", queryset=inventory_qs)
        )
    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category').all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription, IsBusinessAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['name']
    search_fields = ['name', 'code']

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class CategoryViewSet(mixins.CreateModelMixin,mixins.DestroyModelMixin,mixins.ListModelMixin,viewsets.GenericViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]

    def get_queryset(self):
        if self.request.user.role == 'super_admin':
            return Category.objects.all()
        return Category.objects.filter(company=self.request.user.company) 

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class StockMovementViewSet(viewsets.ModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]

    def get_queryset(self):
        qs = StockMovement.objects.select_related('inventory__company')
        user_company = getattr(self.request.user, 'company', None)
        if self.request.user.role != 'super_admin' and user_company is not None:
            qs = qs.filter(inventory__company=user_company)
        return qs.order_by('-date')