from django.urls import path
from .views import CompanyPlanView, reset_company_data

urlpatterns = [
    path("plan/", CompanyPlanView.as_view(), name="company-plan"),
    path('reset/', reset_company_data, name='reset-company-data'),
]
