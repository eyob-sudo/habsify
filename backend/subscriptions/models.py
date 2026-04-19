import uuid
from django.db import models
from django.utils import timezone
from core.models import Company
from datetime import date

class Feature(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

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
    STATUS_TRIALING = "trialing"
    STATUS_ACTIVE = "active"
    STATUS_PENDING_PAYMENT = "pending_payment"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_TRIALING, "Trialing"),
        (STATUS_ACTIVE, "Active (Paid)"),
        (STATUS_PENDING_PAYMENT, "Pending Payment"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(null=False, blank=False)
    active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    @property
    def members_usage(self):
        return self.company.customers.count() + self.company.suppliers.count()
    
    @property
    def members_remaining(self):
        return self.plan.user_limit - self.members_usage

    def __str__(self):
        return f"{self.company.name} - {self.plan.name}"


    @property
    def is_currently_valid(self):
        if self.status in ['expired', 'cancelled', 'pending_payment']:
            return False
        return self.end_date is None or self.end_date >= date.today()
    
    def is_active_now(self):
        if self.status not in [self.STATUS_ACTIVE, self.STATUS_TRIALING]:
            return False
        if self.start_date is None or self.end_date is None:
            return False
        today = date.today()
        return self.start_date <= today <= self.end_date

    @property
    def days_remaining(self):
        return max(0, (self.end_date - date.today()).days)


class PaymentMethod(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class BankAccount(models.Model):
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=30)
    account_holder = models.CharField(max_length=100, default="Habsify Technology")
    branch = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_number}"
    class Meta:
        verbose_name = 'Habsify Bank Account'


class Payment(models.Model):
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    transaction_id = models.CharField(max_length=100, null=True, blank=True, help_text="Bank ref or Telebirr ID")
    proof = models.FileField(upload_to='payment_proofs/', null=True, blank=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subscription.company.name} - {self.amount}"