from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Sale, Purchase  
from inventory.models import StockMovement

@receiver(post_save, sender=Sale)
def create_stock_movement_on_sale(sender, instance, created, **kwargs):
    if created and instance.item:
        StockMovement.objects.create(
            item=instance.item,
            type='out',
            quantity=instance.quantity,
            reference=f"Sale #{instance.id}",
            notes=instance.notes or "Auto-generated from sale"
        )

@receiver(post_save, sender=Purchase)
def create_stock_movement_on_purchase(sender, instance, created, **kwargs):
    if created and instance.item:
        StockMovement.objects.create(
            item=instance.item,
            type='in',
            quantity=instance.quantity,
            reference=f"Purchase #{instance.id}",
            notes=instance.notes or "Auto-generated from purchase"
        )