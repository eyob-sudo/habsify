from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from crm.permissions import HasActiveSubscription
from .services.dashboard_service import DashboardService


class DashboardViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated,HasActiveSubscription]

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        user = request.user
        data = {
            "top_selling_products": DashboardService.get_top_selling_products(user),
            "top_customers": DashboardService.get_top_customers(user),
            "top_suppliers": DashboardService.get_top_suppliers(user),
            "financial_stats": DashboardService.get_financial_stats(user),
            }
        
        return Response(data)