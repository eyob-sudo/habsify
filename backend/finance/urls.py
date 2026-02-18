from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet,TransactionViewSet,finance_stats

routes = DefaultRouter()
routes.register('accounts', AccountViewSet, basename='account')
routes.register('transactions', TransactionViewSet,basename='transaction')

urlpatterns = routes.urls + [
    path('stats/', finance_stats),
]