from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, Profile, PhoneNumber, OTPCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email',
        'role',
        'company_name',
        'is_active',
        'is_staff',
        'is_superuser',
        'phone_verified',
        'email_verified',
        'date_joined',
    )
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser', 'company')
    search_fields = ('email', 'username', 'company__name')
    ordering = ('email',)
    list_select_related = ('company',)
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password', 'role', 'company')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Verification', {'fields': ('is_phone_verified', 'is_email_verified', 'verification_method')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'role', 'company'),
        }),
    )

    def company_name(self, obj):
        return obj.company.name if obj.company else "—"
    company_name.admin_order_field = 'company__name'
    company_name.short_description = 'Company'

    def phone_verified(self, obj):
        return obj.is_phone_verified
    phone_verified.boolean = True

    def email_verified(self, obj):
        return obj.is_email_verified
    email_verified.boolean = True


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'city', 'state', 'zip_code', 'updated_at')
    search_fields = ('user__email', 'city', 'state')
    list_select_related = ('user',)

    def user_email(self, obj):
        return obj.user.email
    user_email.admin_order_field = 'user__email'
    user_email.short_description = 'User Email'
    
@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'user_email', 'type', 'purpose', 'is_used', 'is_expired', 'created_at', 'expires_at')
    search_fields = ('code', 'user__email')
    list_filter = ('type', 'purpose', 'used')
    list_select_related = ('user',)

    def user_email(self, obj):
        return obj.user.email
    user_email.admin_order_field = 'user__email'
    user_email.short_description = 'User Email'

    def is_used(self, obj):
        return obj.used
    is_used.boolean = True

    def is_expired(self, obj):
        return obj.is_expired
    is_expired.boolean = True
