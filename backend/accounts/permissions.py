from rest_framework.permissions import BasePermission, IsAdminUser

class IsBusinessAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "business_admin"
    


class IsBusinessOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return IsBusinessAdmin().has_permission(request, view) or IsAdminUser().has_permission(request, view)
