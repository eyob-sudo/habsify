from rest_framework import serializers
from .models import Supplier
from crm.limits import check_plan_limit
from sales_purchases.models import Purchase
from django.db.models import Sum,Q

class SupplierListSerializer(serializers.ModelSerializer):
    products = serializers.SerializerMethodField()
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Supplier
        fields = (
            'id',
            'name',
            'phone',
            'address',
            'products',
            'balance',
        )
    def validate(self, attrs):
        if self.instance:  
            return attrs

        company = self.context["request"].user.company
        check_plan_limit(company)

        return attrs
    
    def get_products(self, obj):
        products = getattr(obj, 'products', 0)
        return f"{products} items"

class SupplierHistorySerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='item.code', read_only=True)
    units = serializers.SerializerMethodField()
    payable = serializers.DecimalField(source='total', max_digits=12, decimal_places=2, read_only=True)
    payment_sent = serializers.SerializerMethodField()
    bank = serializers.SerializerMethodField()
    remain = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = (
            'date',
            'product_code',
            'units',
            'unit_price',
            'payable',
            'payment_sent',
            'bank',
            'remain',
        )

    def get_units(self, obj):
        return f"{obj.quantity} {getattr(obj.item, 'unit_measure', '')}" 

    def get_payment_sent(self, obj):
        agg = obj.transactions.aggregate(
            total_out=Sum('amount', filter=Q(type='outflow')),
            total_in=Sum('amount', filter=Q(type='inflow')),
        )

        total_out = agg['total_out'] or 0
        total_in = agg['total_in'] or 0

        return total_out - total_in

    def get_bank(self, obj):
        last_txn = obj.transactions.last()
        return last_txn.account.full_name if last_txn and hasattr(last_txn, 'account') else None

    def get_remain(self, obj):
        net_paid = self.get_payment_sent(obj)
        return obj.total - net_paid
        
