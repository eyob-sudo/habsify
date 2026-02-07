from django.db import models
from core.models import Company
from datetime import date

class Feature(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)

    def __str__(self):
        return self.name
    

class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    user_limit = models.IntegerField()
    features = models.ManyToManyField(Feature, blank=True)
    is_active = models.BooleanField(default=True)
    trial_days = models.IntegerField(default=14)

    def __str__(self):
        return f"{self.name} - {self.price_monthly} ETB/month"
    
    class Meta:
        verbose_name = 'Subscription Plan'




class Subscription(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    start_date = models.DateField(default=date.today)
    end_date = models.DateField()
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.company.name} - {self.plan.name}"
    

class PaymentMethod(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30,unique=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Payment(models.Model):
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE,related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.ForeignKey(PaymentMethod,on_delete=models.PROTECT)
    bank_account = models.ForeignKey('BankAccount',on_delete=models.SET_NULL,null=True,blank=True)
    transaction_id = models.CharField(max_length=50, null=True,blank=True)
    proof = models.FileField(upload_to='payment_proofs/', null=True,blank=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subscription.company.name} - {self.amount}"

class BankAccount(models.Model):
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=30)
    account_holder = models.CharField(max_length=100,default="Habsify Technology")
    branch = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_number}"
    
    class Meta:
        verbose_name = 'Habsify Bank Account'
    
