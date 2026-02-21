from rest_framework import serializers
from .models import Sale, Purchase,PaymentStatus
from inventory.models import Inventory
from django.db.models import Sum

class SaleSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField() 

    class Meta:
        model = Sale
        fields = ['id', 
                  'customer', 
                  'item', 
                  'quantity', 
                  'unit_price', 
                  'total', 
                  'date', 
                  'notes', 
                  'warehouse',
                  'status',
                  'payment_method', 
                  'account', 
                  'balance']
        
        read_only_fields = ['total', 'date', 'balance']

    def validate(self, data):
        data['total'] = data['quantity'] * data['unit_price']

        status = data.get('status')
        payment_method = data.get('payment_method')
        account = data.get('account')

        if status == PaymentStatus.UNPAID:
            if account or payment_method:
                raise serializers.ValidationError(
                    "For 'UNPAID' status, account and payment_method must be empty."
                )


        if status == PaymentStatus.PAID:
            if not account or not payment_method:
                raise serializers.ValidationError("For 'paid' status, account and payment_method are required.")
            if payment_method == 'bank_transfer':
                if account.account_type != 'bank':
                    raise serializers.ValidationError("Bank Transfer requires a Bank account.")
                if account.account_number in ['', None]:
                    raise serializers.ValidationError("Choose proper account with number.")
            elif payment_method == 'cash':
                if account.account_type != 'cash':
                    raise serializers.ValidationError("Cash payment requires a Cash account.")
            else:
                raise serializers.ValidationError("Payment method must be 'cash' or 'bank_transfer'.")

            try:
                inventory = Inventory.objects.get(item=data['item'], warehouse=data['warehouse'], company=self.context['request'].user.company)
                if inventory.current_stock < data['quantity']:
                    raise serializers.ValidationError("Product does not have enough stock in the selected warehouse.")
            except Inventory.DoesNotExist:
                raise serializers.ValidationError("Product does not exist in the selected warehouse.")
            return data

        if status == PaymentStatus.PARTIAL:
            if not account or not payment_method:
                raise serializers.ValidationError("For 'partial' status, account and payment_method are required, and you must add transactions separately.")

        return data

    def get_balance(self, obj):
        paid = obj.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        return obj.total - paid

class PurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    balance = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = Purchase
        fields = ['id', 'supplier', 'supplier_name', 'item', 'item_name', 'quantity','warehouse','warehouse_name',
                  'unit_price', 'total', 'date', 'notes', 'status', 'payment_method', 'account', 'balance']
        read_only_fields = ['total', 'date', 'balance'] 

    def validate(self, data):
        data['total'] = data['quantity'] * data['unit_price']

        status = data.get('status')
        payment_method = data.get('payment_method')
        account = data.get('account')

        if status == PaymentStatus.UNPAID:
            if account or payment_method:
                raise serializers.ValidationError(
                    "For 'UNPAID' status, account and payment_method must be empty."
                )

        if status == PaymentStatus.PAID:
            if not account or not payment_method:
                raise serializers.ValidationError("For 'paid' status, account and payment_method are required.")
            if payment_method == 'bank_transfer':
                if account.account_type != 'bank':
                    raise serializers.ValidationError("Bank Transfer requires a Bank account.")
                if account.account_number in ['', None]:
                    raise serializers.ValidationError("Choose proper account with number.")
                if account.balance < data['total']:
                    raise serializers.ValidationError("Insufficient balance in selected account.")
            elif payment_method == 'cash':
                if account.account_type != 'cash':
                    raise serializers.ValidationError("Cash payment requires a Cash account.")
                if account.balance < data['total']:
                    raise serializers.ValidationError("Insufficient balance in selected account.")
            else:
                raise serializers.ValidationError("Payment method must be 'cash' or 'bank_transfer'.")

        if status == PaymentStatus.PARTIAL:
            if not account or not payment_method:
                raise serializers.ValidationError("For 'partial' status, account and payment_method are required, and you must add transactions separately.")

        return data

    def get_balance(self, obj):
        paid = obj.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        return obj.total - paid