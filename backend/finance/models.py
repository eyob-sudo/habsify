from django.db import models, transaction
from core.models import Company

class Account(models.Model):
    TYPE_CHOICES = [
        ('cash', 'Cash on Hand'),
        ('bank', 'Bank Account'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=100)  
    full_name = models.CharField(max_length=255)  
    account_type = models.CharField(max_length=10, choices=TYPE_CHOICES,default='bank')
    account_number = models.CharField(max_length=50, blank=True) 
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.00) 
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_account_type_display()}) - Balance: {self.balance}"

class Transaction(models.Model):
    TYPE_CHOICES = [
        ('inflow', 'Inflow (Income)'),
        ('outflow', 'Outflow (Expense)'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='transactions')
    account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='transactions')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)  
    reference = models.CharField(max_length=100, blank=True) 
    date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    balance_at_time = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    linked_sale = models.ForeignKey(
        'sales_purchases.Sale',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='transactions' 
    )
    linked_purchase = models.ForeignKey(
        'sales_purchases.Purchase',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='transactions'
    )
    
    def __str__(self):
        return f"{self.get_type_display()} {self.amount} on {self.date} - {self.description}"
    
    def save(self, *args, **kwargs):
        if self.account:
            current_balance = self.account.balance

            if self.type == 'inflow':
                new_balance = current_balance + self.amount
                print('==========in====================',new_balance)
            elif self.type == 'outflow':
                
                new_balance = current_balance - self.amount
                print('==========out===================',new_balance)
            else:
                raise ValueError(f"Unknown transaction type: {self.type}")
            
            print(self.amount,'=============================',new_balance)

            self.balance_at_time = new_balance
            self.account.balance = new_balance
            self.account.save(update_fields=['balance'])
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.linked_sale:
                self.linked_sale.update_status()
            if self.linked_purchase:
                self.linked_purchase.update_status()