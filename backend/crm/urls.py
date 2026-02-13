from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet,InteractionViewSet

router = DefaultRouter()
router.register('customers', CustomerViewSet, basename='customer')
router.register('interactions', InteractionViewSet,basename='interaction')

urlpatterns = router.urls