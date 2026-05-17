from django.db.models import Sum, Count,F
from datetime import datetime, timedelta,date
from dateutil.relativedelta import relativedelta
from sales_purchases.models import Sale, Purchase
from inventory.models import Item, Inventory
from finance.models import Account, Transaction
from crm.models import Customer

def get_financial_overview(user):
    company = user.company if user.role != 'super_admin' else None
    
    qs_account = Account.objects.filter(company=company) if company else Account.objects.all()
    qs_transaction = Transaction.objects.filter(company=company) if company else Transaction.objects.all()

    today = datetime.today()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0)

    # Types that affect profit
    PROFIT_IN  = ['revenue', 'refund_in']
    PROFIT_OUT = ['cogs', 'expense', 'refund_out']

    # 1. Net Worth: sum of ALL account balances (capital included)
    net_worth = qs_account.aggregate(total=Sum('balance'))['total'] or 0

    # 2. This Month's Profit
    this_month_tx = qs_transaction.filter(date__gte=start_of_month)

    inflows  = this_month_tx.filter(
        type__in=PROFIT_IN
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    outflows = this_month_tx.filter(
        type__in=PROFIT_OUT
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    total_profit = inflows - outflows

    # 3. This Month's Expenses only
    total_expenses = this_month_tx.filter(
        type='expense'
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    # 4. Last Month's Profit (for comparison)
    last_month_start = start_of_month - relativedelta(months=1)
    last_month_end   = start_of_month - relativedelta(seconds=1)
    last_month_tx    = qs_transaction.filter(
        date__range=[last_month_start, last_month_end]
    )

    inflows_last  = last_month_tx.filter(
        type__in=PROFIT_IN
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    outflows_last = last_month_tx.filter(
        type__in=PROFIT_OUT
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    expenses_last = last_month_tx.filter(
        type='expense'
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    profit_last = inflows_last - outflows_last

    # 5. Net Worth last month estimate
    # Current net worth minus this month's net profit change
    prev_net_worth = net_worth - total_profit

    # 6. Percentage Calculations
    def calc_change(current, previous):
        if not previous or previous == 0:
            return 0
        return ((current - previous) / abs(previous)) * 100

    nw_change      = calc_change(net_worth,     prev_net_worth)
    profit_change  = calc_change(total_profit,  profit_last)
    exp_change     = calc_change(total_expenses, expenses_last)

    bank_balance = qs_account.filter(
        account_type='bank'
    ).aggregate(Sum('balance'))['balance__sum'] or 0

    return {
        "netWorth":            f"${net_worth:,.2f}",
        "totalProfit":         f"${total_profit:,.2f}",
        "totalExpenses":       f"${total_expenses:,.2f}",
        "bankBalance":         f"${bank_balance:,.2f}",
        "netWorthChange":      f"{'+' if nw_change >= 0 else ''}{nw_change:.1f}% from last month",
        "totalProfitChange":   f"{'+' if profit_change >= 0 else ''}{profit_change:.1f}% from last month",
        "totalExpensesChange": f"{'+' if exp_change >= 0 else ''}{exp_change:.1f}% from last month",
    }

def get_business_kpis(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_item = Item.objects.filter(company=company) if company else Item.objects.all()
    qs_customer = Customer.objects.filter(company=company) if company else Customer.objects.all()
    qs_sale = Sale.objects.filter(company=company) if company else Sale.objects.all()
    qs_purchase = Purchase.objects.filter(company=company) if company else Purchase.objects.all()
    qs_inventory = Inventory.objects.filter(company=company) if company else Inventory.objects.all()

    total_products = qs_item.count()
    total_customers = qs_customer.count()
    receivables = qs_sale.filter(status__in=['partial', 'unpaid']).aggregate(Sum('total'))['total__sum'] or 0
    payables = qs_purchase.filter(status__in=['partial', 'unpaid']).aggregate(Sum('total'))['total__sum'] or 0

    low_stock_items = qs_inventory.filter(current_stock__lte=F('low_stock_threshold')).count()
    low_stock_items_text = f"{low_stock_items} low stock items"

    today = datetime.today()
    current_month_start = today.replace(day=1)
    last_month_start = current_month_start + relativedelta(months=-1)
    last_month_end = current_month_start + relativedelta(days=-1)

    customers_this_month = qs_customer.filter(created_at__gte=current_month_start).count()
    customers_last_month = qs_customer.filter(created_at__range=[last_month_start, last_month_end]).count()
    customers_growth = ((customers_this_month - customers_last_month) / customers_last_month * 100) if customers_last_month else 0
    customers_growth_text = f"+{customers_growth:.1f}% growth this month" if customers_growth >= 0 else f"{customers_growth:.1f}% growth this month"

    overdue_invoices = qs_sale.filter(status__in=['partial', 'unpaid'], date__lt=date.today()).count()
    overdue_invoices_text = f"{overdue_invoices} overdue invoices"

    return {
        "totalProducts": f"{total_products:,}",
        "totalCustomers": f"{total_customers:,}",
        "receivables": f"${receivables:,.0f}",
        "payables": f"${payables:,.0f}",
        "lowStockItems": low_stock_items_text,
        "customersGrowth": customers_growth_text,
        "overdueInvoices": overdue_invoices_text,
        "payablesNote": "Due in next 30 days"
    }

def get_top_products(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_sale = Sale.objects.filter(company=company) if company else Sale.objects.all()

    top_products = qs_sale.values('item__name').annotate(
        units=Sum('quantity'),
        revenue=Sum('total')
    ).order_by('-revenue')[:4]

    return [
        {
            "rank": i + 1,
            "name": item['item__name'] or "Unknown",
            "units": item['units'],
            "revenue": f"${item['revenue']:,.0f}"
        } for i, item in enumerate(top_products)
    ]

def get_top_customers(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_sale = Sale.objects.filter(company=company) if company else Sale.objects.all()

    top_customers = qs_sale.values('customer__name').annotate(
        orders=Count('id'),
        revenue=Sum('total')
    ).order_by('-revenue')[:3]

    return [
        {
            "initials": name[:2].upper() if name else "XX",
            "name": name or "Unknown",
            "orders": item['orders'],
            "revenue": f"${item['revenue']:,.0f}"
        } for name, item in zip([c['customer__name'] for c in top_customers], top_customers)
    ]

def get_top_suppliers(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_purchase = Purchase.objects.filter(company=company) if company else Purchase.objects.all()

    top_suppliers = qs_purchase.values('supplier__name').annotate(
        products=Count('item'),
        value=Sum('total')
    ).order_by('-value')[:3]

    return [
        {
            "initials": name[:2].upper() if name else "XX",
            "name": name or "Unknown",
            "products": item['products'],
            "value": f"${item['value']:,.0f}"
        } for name, item in zip([s['supplier__name'] for s in top_suppliers], top_suppliers)
    ]

def get_top_products_chart(user):
    top_products = get_top_products(user)
    return [
        {"value": item['revenue'] or 0, "name": item['name'] or "Unknown", "color": "rgba(87, 181, 231, 1)"}
        for item in top_products
    ]

def get_customer_growth(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_customer = Customer.objects.filter(company=company) if company else Customer.objects.all()

    today = datetime.today()
    customer_growth_labels = []
    customer_growth_data = []
    for month in range(8, -1, -1):
        start = today - relativedelta(months=month)
        end = start + relativedelta(months=1) - timedelta(days=1)
        count = qs_customer.filter(created_at__range=[start, end]).count()
        label = start.strftime("%b")
        customer_growth_labels.append(label)
        customer_growth_data.append(count)

    return {
        "labels": customer_growth_labels,
        "data": customer_growth_data
    }

def get_recent_activity(user):
    if user.role != 'super_admin':
        company = user.company
    else:
        company = None

    qs_transaction = Transaction.objects.filter(company=company) if company else Transaction.objects.all()

    recent_transactions = qs_transaction.order_by('-date')[:5]
    recent_activity = []
    for t in recent_transactions:
        recent_activity.append({
            "type": "order" if t.type == "inflow" else "alert",
            "title": t.description,
            "description": f"Amount: ${t.amount:,.0f}",
            "time": get_time_ago(t.date)
        })

    return recent_activity

def get_time_ago(created_at):
    now = datetime.now(created_at.tzinfo)
    diff = now - created_at
    if diff.days > 365:
        return f"{diff.days // 365} years ago"
    elif diff.days > 30:
        return f"{diff.days // 30} months ago"
    elif diff.days > 0:
        return f"{diff.days} days ago"
    elif diff.seconds > 3600:
        return f"{diff.seconds // 3600} hours ago"
    elif diff.seconds > 60:
        return f"{diff.seconds // 60} minutes ago"
    else:
        return f"{diff.seconds} seconds ago"