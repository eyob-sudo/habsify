from rest_framework.permissions import BasePermission

class HasActiveSubscription(BasePermission):
    message = "Your company does not have an active subscription."

    def has_permission(self, request, view):
        user = request.user
        # Must be authenticated
        if not user or not user.is_authenticated:
            return False
        # Super admin bypass
        if user.role == 'super_admin':
            return True
        company = getattr(user, 'company', None)
        if not company:
            return False
        subscription = getattr(company, 'subscription', None)
        if not subscription:
            return False
        return subscription.active

    

class IsOwnerOrEmployee(BasePermission):
    def has_permission(self, request, view):
        if request.user.role in ['business_admin','employee','super_admin']:
            return True
        return False
    
class IsBusinessAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.user.role in ['business_admin']:
            return True
        return False
