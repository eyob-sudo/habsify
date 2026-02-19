from django.db import models, transaction
from core.models import Company

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

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
        ('in', 'Incoming'),
        ('out', 'Outgoing'),
    ]

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='movements')
    type = models.CharField(max_length=3, choices=MOVEMENT_TYPE_CHOICES)
    quantity = models.PositiveIntegerField()
    reference = models.CharField(max_length=100, blank=True) 
    date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if is_new and self.type == 'out':
            if self.item.current_stock < self.quantity:
                raise ValueError(
                    f"Not enough stock for {self.item.name} "
                    f"(have {self.item.current_stock}, need {self.quantity})"
                )

        with transaction.atomic():
            super().save(*args, **kwargs)

            if is_new:
                if self.type == 'in':
                    self.item.current_stock += self.quantity
                else:  # 'out'
                    self.item.current_stock -= self.quantity

                self.item.save(update_fields=['current_stock'])
    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.type.upper()} {self.quantity} of {self.item.name} on {self.date}"
    