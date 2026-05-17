from rest_framework import serializers
from .models import *
from datetime import timedelta
from django.db import transaction
from dateutil.relativedelta import relativedelta

class FeatureSerializer(serializers.ModelSerializer):
    is_included = serializers.SerializerMethodField()

    class Meta:
        model = Feature
        fields = ['id', 'name', 'code', 'description', 'is_included']

    def get_is_included(self, obj):
        included_feature_ids = self.context.get('included_feature_ids', set())
        return obj.id in included_feature_ids


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()
    has_used_trial = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'price_monthly', 'user_limit', 'trial_days', 'has_used_trial', 'features']

    def get_has_used_trial(self, obj):
        request = self.context.get('request')
        if request and request.user and hasattr(request.user, 'company'):
            return request.user.company.has_used_trial
        return False

    def get_features(self, obj):
        all_features = self.context.get('all_features', [])
        included_ids = self.context.get('plan_features_map', {}).get(obj.id, set())

        serializer = FeatureSerializer(
            all_features, 
            many=True, 
            context={'included_feature_ids': included_ids}
        )
        return serializer.data

class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    has_used_trial =serializers.SerializerMethodField()
    days_remaining = serializers.ReadOnlyField()
    status = serializers.CharField(read_only=True)

    def get_has_used_trial(self,obj):
        return bool(obj.company.has_used_trial)

    class Meta:
        model = Subscription
        fields = ['uid', 'company_name', 'start_date', 'end_date','has_used_trial',
                  'active', 'days_remaining', 'status','members_usage', 'plan']
        read_only_fields = ['uid', 'company_name', 'active', 'start_date', 'end_date']


class FreeTrialSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()

    def validate(self, data):
        request = self.context.get('request')
        user = request.user

        if not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if not hasattr(user, 'company') or not user.company:
            raise serializers.ValidationError("User has no associated company.")

        company = user.company

        if getattr(company, 'has_used_trial', False):
            raise serializers.ValidationError(
                "This company has already used its free trial."
            )

        return data

    def create(self, validated_data):
        plan = SubscriptionPlan.objects.get(pk=validated_data['plan_id'])
        company = self.context['request'].user.company

        with transaction.atomic():
            current_sub = getattr(company, 'subscription', None)

            if current_sub and getattr(current_sub, 'is_active_now', False):
                start_date = current_sub.end_date + timedelta(days=1)
            else:
                start_date = timezone.now().date()

            subscription, _ = Subscription.objects.update_or_create(
                company=company,
                defaults={
                    'plan': plan,
                    'start_date': start_date,
                    'end_date': start_date + timedelta(days=plan.trial_days),
                    'status': Subscription.STATUS_TRIALING,
                    'active': True,
                }
            )

            company.has_used_trial = True
            company.save(update_fields=['has_used_trial'])  

        return subscription
    
class PayNowSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    payment_method = serializers.PrimaryKeyRelatedField(
        queryset=PaymentMethod.objects.filter(is_active=True),
        write_only=True  
    )
    bank_account = serializers.PrimaryKeyRelatedField(
        queryset=BankAccount.objects.all(), 
        required=False,
        write_only=True  
    )
    transaction_id = serializers.CharField(required=False, allow_blank=True)
    # proof = serializers.FileField(required=False)

    def validate(self, data):
        company = self.context['request'].user.company
        existing_sub = getattr(company, 'subscription', None)
        if existing_sub and existing_sub.status in ['trialing', 'active', 'pending_payment']:
            raise serializers.ValidationError(
                "You already have a pending, active, or trialing subscription. "
                "Please wait for approval, cancel it, or contact support to change plans."
            )

        if data['payment_method'].code == 'BANK':
            if not data.get('transaction_id'):
                raise serializers.ValidationError({"detail": "Required for BANK payments."})
            # if not data.get('proof'):
            #     raise serializers.ValidationError({"proof": "Please upload proof for BANK payments."})
            if not data.get('bank_account'):
                raise serializers.ValidationError({"detail": "Required for BANK payments."})

        return data

    def create(self, validated_data):
        plan = SubscriptionPlan.objects.get(id=validated_data['plan_id'])
        company = self.context['request'].user.company
        existing_sub = getattr(company, 'subscription', None)

        if existing_sub and existing_sub.is_currently_valid:
            start_date = existing_sub.end_date + timedelta(days=1)
        else:
            start_date = timezone.now().date()

        end_date = start_date + relativedelta(months=1)

        subscription, _ = Subscription.objects.update_or_create(
            company=company,
            defaults={
                'plan': plan,
                'start_date': start_date,
                'end_date': end_date,
                'status': 'pending_payment',
                'active': False,
            }
        )

        Payment.objects.create(
            subscription=subscription,
            amount=plan.price_monthly,
            payment_method=validated_data['payment_method'],
            transaction_id=validated_data.get('transaction_id'),
            proof=validated_data.get('proof'),
            approved=False,
        )
        return subscription
     
class PaymentMethodSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    def get_label(self,obj):
        return obj.name

    class Meta:
        model = PaymentMethod
        fields = ["id", "label","code"]

class BankAccountSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    def get_label(self,obj):
        return f"{obj.bank_name} | {obj.account_number}"

    class Meta:
        model = BankAccount
        fields = ["id", "label"]

class AccessStatusSerializer(serializers.Serializer):
    company_name = serializers.CharField()
    subscription_status = serializers.CharField()
    days_remaining = serializers.IntegerField(required=False, allow_null=True)

    user_role = serializers.CharField()

    can_enter_app = serializers.BooleanField()
    read_only = serializers.BooleanField()

    action_required = serializers.CharField(
        required=False, allow_null=True
    )
