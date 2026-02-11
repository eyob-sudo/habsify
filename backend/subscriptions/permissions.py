from rest_framework.permissions import BasePermission

class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_staff or user.is_superuser or user.company.owner:
            return True

        return False


class HasValidSubscription(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        company = user.company
        if not company:
            return False
        subscription = getattr(company, "subscription", None)
        if not subscription:
            return False

        return subscription.is_currently_valid
