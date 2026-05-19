from rest_framework import serializers
from sales_purchases.models import Sale
from crm.limits import check_plan_limit
from .models import Customer,Interaction
from django.db.models import Sum
from django.db.models import Sum, Q
from finance.models import Transaction  


class CustomerTransactionHistorySerializer(serializers.ModelSerializer):
    units = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="item.name", read_only=True)
    product_code = serializers.SerializerMethodField()
    product_price = serializers.SerializerMethodField()
    payable = serializers.SerializerMethodField()
    payment_received = serializers.SerializerMethodField()
    bank = serializers.SerializerMethodField()
    remain = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'date', 'units', 'product_name',
            'product_code', 'product_price', 'payable',
            'payment_received', 'bank', 'remain'
        ]

    def get_units(self, obj):
        return f"{obj.quantity} {getattr(obj.item, 'unit_measure', '')}"

    def get_product_code(self, obj):
        return obj.item.code if obj.item else "N/A"

    def get_product_price(self, obj):
        return float(obj.unit_price)

    def get_payable(self, obj):
        return float(obj.total)

    def get_payment_received(self, obj):
        payments = obj.transactions.select_related('account').order_by('date')
        if not payments.exists():
            return "0"

        parts = []
        for t in payments:
            if t.type == 'revenue':
                sign = "+"
            elif t.type == 'refund_out':
                sign = "-"
            else:
                continue  # skip expense/capital/cogs - not related to this sale
            bank_name = t.account.name if t.account else "Unknown"
            date_str = t.date.strftime('%Y-%m-%d')
            parts.append(f"{sign}{t.amount} via {bank_name} on {date_str}")

        return ', '.join(parts) if parts else "0"

    def get_bank(self, obj):
        payments = obj.transactions.select_related('account').filter(
            type__in=['revenue', 'refund_out']
        )
        banks = set(t.account.name for t in payments if t.account)
        return ', '.join(banks) if banks else "N/A"

    def get_remain(self, obj):
        agg = obj.transactions.aggregate(
            total_received=Sum('amount', filter=Q(type='revenue')),
            total_refunded=Sum('amount', filter=Q(type='refund_out')),
        )
        total_received = agg['total_received'] or 0
        total_refunded = agg['total_refunded'] or 0
        net_received = total_received - total_refunded
        return float(obj.total - net_received)


class CustomerSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'address', 'products_count', 'balance', 'notes']

    def validate(self, attrs):
        if self.instance:
            return attrs
        company = self.context["request"].user.company
        check_plan_limit(company)
        return attrs

    def get_products_count(self, obj):
        if not obj.company:
            return 0
        return obj.sales.filter(company=obj.company).values('item').distinct().count()

    def get_balance(self, obj):
        sales_qs = obj.sales.filter(company=obj.company)

        total_payable = sales_qs.aggregate(
            total=Sum('total')
        )['total'] or 0

        sale_ids = sales_qs.values_list('id', flat=True)

        agg = Transaction.objects.filter(
            linked_sale__in=sale_ids
        ).aggregate(
            total_received=Sum('amount', filter=Q(type='revenue')),
            total_refunded=Sum('amount', filter=Q(type='refund_out')),
        )

        total_received = agg['total_received'] or 0
        total_refunded = agg['total_refunded'] or 0
        net_received = total_received - total_refunded

        return float(total_payable - net_received)

class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = '__all__'
        read_only_fields = ['customer', 'created_by', 'date']


class CustomerDropdownSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField() 

    def get_label(self, obj):
        phone = obj.phone or "No phone"
        return f"{obj.name} | {phone}"
    
    class Meta:
        model = Customer
        fields = ["id","label"]

        