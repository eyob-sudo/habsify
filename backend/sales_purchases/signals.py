import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.db import transaction

from inventory.models import StockMovement, Inventory
from sales_purchases.models import Purchase, Sale, PaymentStatus
from notifications.models import Notification

logger = logging.getLogger(__name__)



@receiver(post_save, sender=Sale, dispatch_uid="create_stock_movement_for_sale")
def create_stock_movement_for_sale(sender, instance, created, **kwargs):
    """
    Every new sale reduces stock regardless of payment status.
    Stock leaves warehouse when sale is created.
    """
    if not created:
        return
    if not instance.item or not instance.warehouse:
        return

    try:
        inventory = Inventory.objects.get(
            item=instance.item,
            warehouse=instance.warehouse
        )
    except Inventory.DoesNotExist:
        raise ValueError(
            f"No inventory found for {instance.item} in {instance.warehouse}"
        )

    if inventory.current_stock < instance.quantity:
        raise ValidationError(
            f"Not enough stock in {inventory.warehouse.name}"
        )

    if StockMovement.objects.filter(sale=instance, inventory=inventory).exists():
        return

    with transaction.atomic():
        StockMovement.objects.create(
            inventory=inventory,
            movement_type="sale",
            quantity=-instance.quantity,
            sale=instance,
            notes=instance.notes or "Auto-generated from sale"
        )


@receiver(post_save, sender=Purchase, dispatch_uid="create_stock_movement_for_purchase")
def create_stock_movement_for_purchase(sender, instance, created, **kwargs):
    """
    Every new purchase increases stock regardless of payment status.
    Stock enters warehouse when purchase is created.
    """
    if not created:
        return
    if not instance.item or not instance.warehouse:
        return

    inventory, _ = Inventory.objects.get_or_create(
        company=instance.company,
        item=instance.item,
        warehouse=instance.warehouse,
        defaults={"current_stock": 0, "low_stock_threshold": 5}
    )

    if StockMovement.objects.filter(
        purchase=instance, inventory=inventory
    ).exists():
        return

    with transaction.atomic():
        StockMovement.objects.create(
            inventory=inventory,
            movement_type="purchase",
            quantity=instance.quantity,
            purchase=instance,
            notes=instance.notes or "Auto-generated from purchase"
        )



@receiver(post_save, sender=Sale, dispatch_uid='handle_sale_payment_unique')
def handle_sale_payment(sender, instance, created, **kwargs):
    if not created:
        return

    # Only auto-handle 'paid' status
    if instance.status != PaymentStatus.PAID:
        return

    if not instance.account:
        return

    reference = f"SALE-{instance.id}"

    from finance.models import Transaction as FinanceTransaction

    if FinanceTransaction.objects.filter(reference=reference).exists():
        logger.warning(
            f"Transaction already exists for {reference}, skipping"
        )
        return

    if instance.transactions.exists():
        return

    with transaction.atomic():
        FinanceTransaction.objects.create(
            company=instance.company,
            account=instance.account,
            type='revenue',                   
            amount=instance.total,
            description=f"Sale to {instance.customer.name if instance.customer else 'Customer'}",
            reference=reference,
            notes=f"Payment Method: {instance.payment_method}\n{instance.notes or ''}",
            linked_sale=instance
        )


@receiver(post_save, sender=Purchase, dispatch_uid='handle_purchase_payment_unique')
def handle_purchase_payment(sender, instance, created, **kwargs):
    if not created:
        return

    # Only auto-handle 'paid' status
    if instance.status != PaymentStatus.PAID:
        return

    if not instance.account:
        return

    reference = f"PURCHASE-{instance.id}"

    from finance.models import Transaction as FinanceTransaction

    if FinanceTransaction.objects.filter(reference=reference).exists():
        logger.warning(
            f"Transaction already exists for {reference}, skipping"
        )
        return

    if instance.transactions.exists():
        return

    with transaction.atomic():
        FinanceTransaction.objects.create(
            company=instance.company,
            account=instance.account,
            type='cogs',                      
            amount=instance.total,
            description=f"Purchase from {instance.supplier.name if instance.supplier else 'Supplier'}",
            reference=reference,
            notes=f"Payment Method: {instance.payment_method}\n{instance.notes or ''}",
            linked_purchase=instance
        )

@receiver(post_save, sender=StockMovement)
def trigger_low_stock_notification(sender, instance, created, **kwargs):
    if not created:
        return

    inventory = instance.inventory
    stock_reducing = (
        instance.movement_type in ['sale', 'transfer_out'] or
        (instance.movement_type == 'adjustment' and instance.quantity < 0)
    )

    if stock_reducing and inventory.is_low_stock:
        Notification.objects.create(
            company=inventory.company,
            user=inventory.company.owner,
            type='low_stock',
            message=(
                f"{inventory.item.name} stock low in "
                f"{inventory.warehouse.name}: {inventory.current_stock} left "
                f"(threshold {inventory.low_stock_threshold})"
            )
        )