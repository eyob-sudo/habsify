from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ItemViewSet, StockMovementViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet,basename='category')
router.register('items', ItemViewSet,basename='item')
router.register('stock-movements', StockMovementViewSet,basename='stock-movement')

urlpatterns = [
    path('', include(router.urls)),
]