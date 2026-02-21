from rest_framework import serializers
from .models import Item, Category, StockMovement,Warehouse,Inventory


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description'] 
        read_only_fields = ['company']
        
    def validate(self, attrs):
        name = attrs.get('name', '').strip()

        if Category.objects.filter(name__iexact=name).exists():
            raise serializers.ValidationError({
                'name': 'This category name is already taken.'
            })

        attrs['name'] = name.capitalize()
        return attrs


class WarehouseOverviewSerializer(serializers.ModelSerializer):
    total_stock = serializers.SerializerMethodField()
    total_worth = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'address', 'total_stock', 'total_worth']

    def get_total_stock(self, obj):
        return sum(item.current_stock for item in obj.inventories.all())

    def get_total_worth(self, obj):
        total = sum(item.current_stock * item.item.unit_price for item in obj.inventories.all())
        return f"${total:,.2f}"


class WarehouseInventorySerializer(serializers.ModelSerializer):
    product = serializers.CharField(source='item.name', read_only=True)
    category = serializers.SerializerMethodField()
    stock = serializers.IntegerField(source='current_stock', read_only=True)
    unit_price = serializers.DecimalField(source='item.unit_price', max_digits=10, decimal_places=2, read_only=True)
    worth = serializers.SerializerMethodField()

    class Meta:
        model = Inventory
        fields = ['id', 'product', 'category', 'stock', 'unit_price', 'worth']

    def get_category(self, obj):
        return obj.item.category.name if obj.item.category else "Uncategorized"

    def get_worth(self, obj):
        return f"${obj.current_stock * obj.item.unit_price:,.2f}"


class WarehouseDetailSerializer(serializers.ModelSerializer):
    products = WarehouseInventorySerializer(many=True, source='inventories', read_only=True)
    total_stock = serializers.SerializerMethodField()
    total_worth = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'address', 'created_at', 'products', 'total_stock', 'total_worth']

    def get_total_stock(self, obj):
        return sum(inv.current_stock for inv in obj.inventories.all())

    def get_total_worth(self, obj):
        total = sum(inv.current_stock * inv.item.unit_price for inv in obj.inventories.all())
        return f"${total:,.2f}"


class WarehouseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ['name', 'address']


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'name', 'code', 'category', 'unit_price']
        read_only_fields = ['company'] 


class StockMovementSerializer(serializers.ModelSerializer):

    class Meta:
        model = StockMovement
        fields = '__all__'

    def validate(self, data):
        movement_type = data.get('movement_type')
        purchase = data.get('purchase')
        sale = data.get('sale')
        inventory = data.get('inventory')
        quantity = data.get('quantity')  # Already validated as int by model field

        if movement_type == 'purchase' and not purchase:
            raise serializers.ValidationError("Purchase movement requires purchase field.")
        if movement_type == 'sale' and not sale:
            raise serializers.ValidationError("Sale movement requires sale field.")
        if movement_type == 'adjustment' and (purchase or sale):
            raise serializers.ValidationError("Adjustment should not link to purchase or sale.")

        user_company = self.context['request'].user.company
        if inventory and inventory.company != user_company:
            raise serializers.ValidationError("Inventory must belong to the user's company.")

        new_stock = inventory.current_stock + quantity
        if new_stock < 0:
            raise serializers.ValidationError(
                f"Not enough stock in {inventory.warehouse.name}. "
                f"Current stock: {inventory.current_stock}, Requested change: {quantity}"
            )

        return data

