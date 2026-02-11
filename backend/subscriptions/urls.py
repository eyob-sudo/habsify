from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubscriptionPlanViewSet, SubscriptionViewSet)

router = DefaultRouter()
router.register('plans', SubscriptionPlanViewSet, basename='plan')
router.register('subscriptions', SubscriptionViewSet, basename='subscription')



urlpatterns = [
    path('', include(router.urls)),
]