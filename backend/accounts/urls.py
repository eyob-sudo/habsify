from django.urls import path
# from accounts.views import SendOTPView,VerifyOTPView, ActivationView

from rest_framework.routers import DefaultRouter
from .views import ActivationView
# SendOTPView, VerifyOTPView

router = DefaultRouter()
# router.register('send-otp', SendOTPView, basename='send-otp')
# router.register('verify-otp', VerifyOTPView, basename='verify-otp')

urlpatterns = [
    *router.urls,
    path('activate/<str:uid>/<str:token>/', ActivationView.as_view(), name='activate'),
]