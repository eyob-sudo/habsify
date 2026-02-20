from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction as db_transaction
from django.core.exceptions import ObjectDoesNotExist
from finance.models import Transaction
from .models import Sale, Purchase  

import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Sale, dispatch_uid='handle_sale_payment_unique')
def handle_sale_payment(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.status != 'paid' or not instance.account:
        return

    reference = f"SALE-{instance.id}"
    if Transaction.objects.filter(reference=reference).exists():
        logger.warning(f"Transaction already exists for {reference}, skipping creation")
        return

    try:
        if instance.transactions.exists():
            return
    except ObjectDoesNotExist:
        pass

    with db_transaction.atomic():
        trans = Transaction.objects.create(
            company=instance.company,
            account=instance.account,
            type='inflow',
            amount=instance.total,
            description=f"Sale to {instance.customer.name if instance.customer else 'Customer'}",
            reference=reference,
            notes=f"Payment Method: {instance.payment_method}\n{instance.notes or ''}",
            linked_sale=instance
        )
        instance.update_status()

@receiver(post_save, sender=Purchase, dispatch_uid='handle_purchase_payment_unique')
def handle_purchase_payment(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.status != 'paid' or not instance.account:
        return

    reference = f"PURCHASE-{instance.id}"
    if Transaction.objects.filter(reference=reference).exists():
        logger.warning(f"Transaction already exists for {reference}, skipping creation")
        return

    try:
        if instance.transactions.exists():
            return
    except ObjectDoesNotExist:
        pass

    with db_transaction.atomic():
        trans = Transaction.objects.create(
            company=instance.company,
            account=instance.account,
            type='outflow',
            amount=instance.total,
            description=f"Purchase from {instance.supplier.name if instance.supplier else 'Supplier'}",
            reference=reference,
            notes=f"Payment Method: {instance.payment_method}\n{instance.notes or ''}",
            linked_purchase=instance
        )
        instance.update_status()