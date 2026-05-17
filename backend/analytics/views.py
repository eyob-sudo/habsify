from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from crm.permissions import HasActiveSubscription
from .utils import (get_financial_overview, 
                    get_business_kpis, 
                    get_top_products, 
                    get_top_customers, 
                    get_top_suppliers, 
                    get_top_products_chart, 
                    get_customer_growth, 
                    get_recent_activity)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_overview_view(request):
    data = get_financial_overview(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def business_kpis_view(request):
    data = get_business_kpis(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_products_view(request):
    data = get_top_products(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_customers_view(request):
    data = get_top_customers(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_suppliers_view(request):
    data = get_top_suppliers(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_products_chart_view(request):
    data = get_top_products_chart(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_growth_view(request):
    data = get_customer_growth(request.user)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activity_view(request):
    data = get_recent_activity(request.user)
    return Response(data)