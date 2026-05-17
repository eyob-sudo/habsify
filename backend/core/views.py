from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Company
from .serializers import CompanyPlanSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from crm.permissions import HasActiveSubscription
from finance.models import Account,Transaction




class CompanyPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        default_data = {
            "plan_name": "No Plan",
            "max_members": 0,
            "members_used": 0,
            "remaining_members": 0,
            "days_remaining": 0,
        }

        try:
            company = Company.objects.filter(owner=request.user).first()

            if not company:
                raise AttributeError("No company found")

            subscription = getattr(company, 'subscription', None)

            if not subscription:
                data = default_data
            else:
                plan = getattr(subscription, 'plan', None)

                data = {
                    "plan_name": plan.name if plan else "No Plan",
                    "max_members": plan.user_limit if plan else 0,
                    "members_used": getattr(subscription, 'members_usage', 0),
                    "remaining_members": getattr(subscription, 'members_remaining', 0),
                    "days_remaining": getattr(subscription, 'days_remaining', 0),
                }

        except Exception: 
            data = default_data

        serializer = CompanyPlanSerializer(data)
        return Response(serializer.data)



@api_view(['POST'])
@permission_classes([IsAuthenticated, HasActiveSubscription])
def reset_company_data(request):
    """
    Deletes ALL company data:
    - All transactions
    - All sales
    - All purchases
    - All stock movements
    - Resets all account balances to 0
    - Resets all inventory stock to 0

    Requires { "confirm": true } in request body.
    Only business_admin or super_admin can perform this action.
    """
    user = request.user

    # Only admins can reset
    if user.role not in ['business_admin', 'super_admin']:
        return Response(
            {"detail": "You do not have permission to reset company data."},
            status=status.HTTP_403_FORBIDDEN
        )

    # Require explicit confirmation
    confirm = request.data.get('confirm', False)
    if confirm is not True:
        return Response(
            {"detail": "Please confirm that you want to reset all company data by clicking the confirm button."},
            status=status.HTTP_400_BAD_REQUEST
        )

    company = user.company
    if not company:
        return Response(
            {"detail": "User has no company associated."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Lazy imports to avoid circular import errors
    from sales_purchases.models import Sale, Purchase
    from inventory.models import StockMovement, Inventory,Category,Warehouse,Item
    from crm.models import Customer, Interaction
    from notifications.models import Notification
    from suppliers.models import Supplier
    from tasks.models import Task


    with transaction.atomic():
        
        # Financial
        Transaction.objects.filter(company=company).delete()
        Account.objects.filter(company=company).delete()

        # Sales & Purchases
        Sale.objects.filter(company=company).delete()
        Purchase.objects.filter(company=company).delete()

        # Inventory
        StockMovement.objects.filter(inventory__company=company).delete()
        Inventory.objects.filter(company=company).delete()
        Item.objects.filter(company=company).delete()
        Category.objects.filter(company=company).delete()
        Warehouse.objects.filter(company=company).delete()

        # CRM
        Interaction.objects.filter(customer__company=company).delete()
        Customer.objects.filter(company=company).delete()

        # Others
        Notification.objects.filter(company=company).delete()
        Task.objects.filter(company=company).delete()
        Supplier.objects.filter(company=company).delete()

    return Response(
        {
            "detail": "All company data has been reset successfully.",
        },
        status=status.HTTP_200_OK
    )
