from rest_framework.exceptions import ValidationError

def check_plan_limit(company):
    subscription = company.subscription
    limit = subscription.plan.user_limit

    total = company.customers.count() + company.suppliers.count()

    if total >= limit:
        raise ValidationError(
            "You have reached the maximum number of people allowed in your current plan."
        )