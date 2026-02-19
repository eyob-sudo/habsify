from django.db.models.signals import post_save
from django.dispatch import receiver
from inventory.models import StockMovement
from sales_purchases.models import Sale, Purchase  

import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Sale, dispatch_uid='create_stock_movement_on_sale_unique')
def create_stock_movement_on_sale(sender, instance, created, **kwargs):
    if not created or not instance.item:
        return

    reference = f"Sale #{instance.id}"
    if StockMovement.objects.filter(reference=reference, item=instance.item).exists():
        logger.warning(f"Stock movement already exists for {reference}, skipping creation")
        return

    StockMovement.objects.create(
        item=instance.item,
        type='out',
        quantity=instance.quantity,
        reference=reference,
        notes=instance.notes or "Auto-generated from sale"
    )

@receiver(post_save, sender=Purchase, dispatch_uid='create_stock_movement_on_purchase_unique')
def create_stock_movement_on_purchase(sender, instance, created, **kwargs):
    if not created or not instance.item:
        return

    reference = f"Purchase #{instance.id}"
    if StockMovement.objects.filter(reference=reference, item=instance.item).exists():
        logger.warning(f"Stock movement already exists for {reference}, skipping creation")
        return

    StockMovement.objects.create(
        item=instance.item,
        type='in',
        quantity=instance.quantity,
        reference=reference,
        notes=instance.notes or "Auto-generated from purchase"
    )
