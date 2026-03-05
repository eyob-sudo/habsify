from rest_framework import serializers
from sales_purchases.models import Sale
from crm.limits import check_plan_limit
from .models import Customer,Interaction
from django.db.models import Sum


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
            'id',
            'date',
            'units',
            'product_name',
            'product_code',
            'product_price',
            'payable',
            'payment_received',
            'bank',
            'remain'
        ]

    def get_units(self, obj):
        return f"{obj.quantity} {getattr(obj.item, 'unit_measure', '')}" 

    def get_product_code(self,obj):
        return obj.item.code if obj.item else "N/A"
    
    def get_product_price(self,obj):
        return  float(obj.unit_price)
    
    def get_payable(self,obj):
        return  float(obj.total)
    
    def get_payment_received(self,obj):
        payments = obj.transactions.all().order_by('date')
        return ', '.join([f"{t.amount} via {t.account.name} on {t.date.strftime('%Y-%m-%d')}" for t in payments]) if payments else "0"

    def get_bank(self,obj):
        payments = obj.transactions.all().order_by('date')
        return ', '.join(set([t.account.name for t in payments if t.account])) if payments else "N/A"
    
    def get_remain(self,obj):
        payments = obj.transactions.all().order_by('date')
        paid = payments.aggregate(Sum('amount'))['amount__sum'] or 0
        return obj.total - paid


class CustomerSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'name',
            'phone',
            'address',
            'products_count',
            'notes',
        ]

    def validate(self, attrs):
        if self.instance: 
            return attrs

        company = self.context["request"].user.company
        check_plan_limit(company)

        return attrs

    def get_products_count(self, obj):
        return obj.sales.values('item').distinct().count()

    
class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = '__all__'
        read_only_fields = ['customer', 'created_by', 'date']