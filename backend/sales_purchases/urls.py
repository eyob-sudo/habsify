from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    SaleViewSet, 
    PurchaseViewSet,
    PurchaseDropdownViewSet,
    SaleDropdownViewSet,
    SupplierListForDropdown,
    ItemListForDropdown,
    WarehouseListForDropdown
)

router = DefaultRouter()
router.register('sales', SaleViewSet, basename='sales')
router.register('purchases', PurchaseViewSet, basename='purchase')
router.register('purchase-dropdown', PurchaseDropdownViewSet, basename='purchase-dropdown')
router.register('sale-dropdown', SaleDropdownViewSet, basename='sale-dropdown')

urlpatterns = router.urls + [
    path('suppliers/dropdown/', SupplierListForDropdown.as_view(), name='supplier-dropdown'),
    path('items/dropdown/', ItemListForDropdown.as_view(), name='item-dropdown'),
    path('warehouses/dropdown/', WarehouseListForDropdown.as_view(), name='warehouse-dropdown'),
]