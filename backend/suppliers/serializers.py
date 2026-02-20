from rest_framework import serializers
from .models import Supplier
from sales_purchases.models import Purchase
from django.db.models import Sum

class SupplierSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()  
    transaction_history = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone','address', 'products_count', 'notes','category', 'transaction_history']

    def get_category(self, obj):
        return Purchase.objects.filter(supplier=obj).values_list('item__category__name',flat=True).distinct()


    def get_products_count(self, obj):
        return Purchase.objects.filter(supplier=obj).values('item').distinct().count()


    def get_transaction_history(self, obj):
        purchases = Purchase.objects.filter(supplier=obj).order_by('-date')[:10]  
        history = []
        for p in purchases:
            payments = p.transactions.all().order_by('date')
            paid = payments.aggregate(Sum('amount'))['amount__sum'] or 0
            remain = p.total - paid
            payment_sent = ', '.join([f"{t.amount} via {t.account.name} on {t.date.strftime('%Y-%m-%d')}" for t in payments]) if payments else "0"
            bank = ', '.join(set([t.account.name for t in payments if t.account])) if payments else "N/A"
            history.append({
                "purchase_id": p.id,
                "transaction_ids": list(payments.values_list('id', flat=True)),
                "date": p.date.strftime("%Y-%m-%d"),
                "product_code": p.item.code if p.item else "N/A",
                "units": p.quantity,
                "product_price": p.unit_price,
                "payable": p.total,
                "payment_sent": payment_sent,
                "bank": bank,
                "remain": remain
            })
        return history
    
