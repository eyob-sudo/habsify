from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Payment
from datetime import timedelta,date

# @receiver(post_save, sender=Payment)
# def extend_on_approval(sender, instance, **kwargs):
#     if instance.approved and instance.subscription:
#         sub = instance.subscription
#         if sub.plan.price_monthly > 0:
#             if sub.end_date:
#                 sub.end_date += timedelta(days=30)
#             else:
#                 sub.end_date = date.today() + timedelta(days=30)
#             sub.active = True
#             sub.save()

@receiver(post_save, sender=Payment)
def activate_on_approval(sender, instance, **kwargs):
    if instance.approved and instance.subscription:
        sub = instance.subscription
        sub.status = 'active'
        sub.active = True
        sub.save()