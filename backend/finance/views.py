from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from datetime import datetime
from dateutil.relativedelta import relativedelta
from crm.permissions import HasActiveSubscription
from .models import Account, Transaction
from .serializers import AccountSerializer, TransactionSerializer


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    filter_backends = [OrderingFilter, SearchFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'balance']

    def get_queryset(self):
        if self.request.user.role == 'super_admin':
            return Account.objects.all()
        return Account.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    filter_backends = [OrderingFilter, SearchFilter]
    search_fields = ['description', 'reference']
    ordering_fields = ['date', 'amount']

    def get_queryset(self):
        if self.request.user.role == 'super_admin':
            return Transaction.objects.all()
        return Transaction.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


@api_view(['GET'])
@permission_classes([HasActiveSubscription,IsAuthenticated])
def finance_stats(request):
    if request.user.role != 'super_admin':
        transactions = Transaction.objects.filter(company=request.user.company)
        accounts = Account.objects.filter(company=request.user.company)
    else:
        transactions = Transaction.objects.all()
        accounts = Account.objects.all()

    # Current month dates for "This Month"
    today = datetime.today()
    current_month_start = today.replace(day=1)
    current_month_end = current_month_start + relativedelta(months=1, days=-1)

    # Last month for % change
    last_month_start = current_month_start + relativedelta(months=-1)
    last_month_end = current_month_start + relativedelta(days=-1)

    # Total Expenses this month + change
    total_expenses_current = transactions.filter(type='expense', date__range=[current_month_start, current_month_end]).aggregate(Sum('amount'))['amount__sum'] or 0
    total_expenses_last = transactions.filter(type='expense', date__range=[last_month_start, last_month_end]).aggregate(Sum('amount'))['amount__sum'] or 0
    expenses_change = ((total_expenses_current - total_expenses_last) / total_expenses_last * 100) if total_expenses_last else 0

    # Cash on Hand (cash type)
    cash_on_hand = accounts.filter(account_type='cash').aggregate(Sum('balance'))['balance__sum'] or 0

    # Inflows/Outflows this month (for Cash Management page)
    total_inflows = transactions.filter(type='income', date__range=[current_month_start, current_month_end]).aggregate(Sum('amount'))['amount__sum'] or 0
    total_outflows = total_expenses_current

    # Bank balances with labels
    banks = accounts.filter(account_type='bank')
    banks_formatted = [
        {
            'id': bank.id,
            'name': bank.name,
            'full_name':  bank.full_name,
            'account_number': bank.account_number,
            'balance': bank.balance,
            'label': 'Available Balance'
        } for bank in banks
    ]
    total_bank_balance = banks.aggregate(Sum('balance'))['balance__sum'] or 0
    total_all = cash_on_hand + total_bank_balance

    return Response({
        'total_expenses': {
            'amount': total_expenses_current,
            'change_vs_last_month': f"+{expenses_change:.1f}%" if expenses_change > 0 else f"{expenses_change:.1f}%",
            'label': 'Operating Costs'
        },
        'total_inflows': total_inflows,
        'total_outflows': total_outflows,
        'cash_on_hand': {
            'amount': cash_on_hand,
            'label': 'Physical Currency',
            'available_label': 'Available Cash' 
        },
        'banks': banks_formatted,
        'total_all': {
            'amount': total_all,
            'label': 'Total Money on Hand' 
        }
    })