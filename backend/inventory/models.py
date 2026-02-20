from django.db import models, transaction
from core.models import Company
from django.core.exceptions import ValidationError


class Category(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        unique_together = ['company', 'name']  

    def __str__(self):
        return self.name
    
class Item(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='items')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    warehouse_address = models.CharField(max_length=200, blank=True)
    current_stock = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code}) - Stock: {self.current_stock}"


class StockMovement(models.Model):

    MOVEMENT_TYPE_CHOICES = [
        ('purchase', 'Purchase'),
        ('sale', 'Sale'),
        ('adjustment', 'Adjustment'),
    ]

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPE_CHOICES)
    quantity = models.IntegerField() 
    date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    purchase = models.ForeignKey('sales_purchases.Purchase',null=True,blank=True,on_delete=models.CASCADE)

    sale = models.ForeignKey('sales_purchases.Sale',null=True,blank=True,on_delete=models.CASCADE)

    def save(self, *args, **kwargs):

        if self.pk:
            raise ValidationError("Editing stock movements is not allowed.")

        if self.item.current_stock + self.quantity < 0:
            raise ValidationError(
                f"Not enough stock for {self.item.name}"
            )

        with transaction.atomic():
            super().save(*args, **kwargs)
            self.item.current_stock += self.quantity
            self.item.save(update_fields=['current_stock'])

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.movement_type} {self.quantity} of {self.item.name}"

    