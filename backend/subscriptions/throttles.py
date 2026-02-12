from rest_framework.throttling import UserRateThrottle

class SubscriptionGlobalThrottle(UserRateThrottle):
    scope = 'subscriptions_global'
    rate = '20/minute'

class SubscribeAndPayThrottle(UserRateThrottle):
    """Max 3 requests per hour per user on Subscribe & Pay Now"""
    scope = 'subscribe_and_pay'
    rate = '5/min'