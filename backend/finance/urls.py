from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (AccountViewSet,
                    TransactionViewSet,
                    finance_stats, 
                    cash_management,
                    ExpenseCreateView,
                    transaction_type_dropdown)

routes = DefaultRouter()
routes.register('accounts', AccountViewSet, basename='account')
routes.register('transactions', TransactionViewSet,basename='transaction')

urlpatterns = routes.urls + [
    path('stats/', finance_stats, name='stats-management'),
    path('cash/', cash_management, name='cash-management'),
    path('expenses/', ExpenseCreateView.as_view(), name='expense-create'),
    path('transaction-types/', transaction_type_dropdown, name='transaction-type-dropdown'),
]

