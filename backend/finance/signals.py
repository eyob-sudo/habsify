from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import Company
from .models import Account

@receiver(post_save, sender=Company)
def create_default_cash_account(sender, instance, created, **kwargs):
    if created:  
        Account.objects.create(
            company=instance,
            name="Cash on Hand",
            full_name="Cash on Hand",
            account_type="cash",     
            account_number="", 
            balance=0.00
        )