from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ActivationView, VerifyViewSet # SendOTPView 

router = DefaultRouter()
# router.register('send-otp', SendOTPView, basename='send-otp')
router.register('verify-otp', VerifyViewSet, basename='verify-otp')

urlpatterns = [
    *router.urls,
    path('activate/<str:uid>/<str:token>/', ActivationView.as_view(), name='activate'),
]