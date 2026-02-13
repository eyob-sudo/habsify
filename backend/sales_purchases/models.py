from django.db import models
from core.models import Company
from crm.models import Customer
from suppliers.models import Supplier
from inventory.models import Item  

class Sale(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True)
    item = models.ForeignKey('inventory.Item', on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)  # quantity * unit_price
    date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Sale to {self.customer or 'Cash'} - {self.total}"

class Purchase(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)
    item = models.ForeignKey('inventory.Item', on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Purchase from {self.supplier or 'Cash'} - {self.total}"