from rest_framework import serializers
from .models import *



class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ['id', 'name', 'code', 'description']

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features = FeatureSerializer(many=True, read_only=True)

    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'price_monthly', 'user_limit', 'trial_days', 'features']

class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    days_remaining = serializers.ReadOnlyField()
    status = serializers.ReadOnlyField()

    class Meta:
        model = Subscription
        fields = ['uid', 'company_name', 'plan', 'start_date', 'end_date',
                  'active', 'days_remaining', 'status']
        read_only_fields = ['uid', 'company_name', 'active', 'start_date', 'end_date']

class FreeTrialSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()

    def create(self, validated_data):
        plan = SubscriptionPlan.objects.get(id=validated_data['plan_id'])
        company = self.context['request'].user.company

        end_date = None if plan.price_monthly == 0 else (
            timezone.now().date() + timedelta(days=plan.trial_days)
        )

        subscription, _ = Subscription.objects.update_or_create(
            company=company,
            defaults={
                'plan': plan,
                'start_date': timezone.now().date(),
                'end_date': end_date,
                'active': True,
            }
        )
        return subscription

class PayNowSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    payment_method = serializers.PrimaryKeyRelatedField(queryset=PaymentMethod.objects.filter(is_active=True))
    transaction_id = serializers.CharField(required=False, allow_blank=True)
    proof = serializers.FileField(required=False)

    def validate(self, data):
            request = self.context['request']
            company = request.user.company

            existing = getattr(company, 'subscription', None)
            if existing and existing.status == 'pending_payment':
                raise serializers.ValidationError(
                    "You already have a pending payment. "
                    "Please wait for approval before creating a new one."
                )

            if data['payment_method'].code == 'BANK':
                if not data.get('transaction_id'):
                    raise serializers.ValidationError({"transaction_id": "Required"})
                if not data.get('proof'):
                    raise serializers.ValidationError({"proof": "Please upload proof"})

            return data

    def create(self, validated_data):
        plan = SubscriptionPlan.objects.get(id=validated_data['plan_id'])
        company = self.context['request'].user.company

        # Create / Update with pending_payment status
        subscription, _ = Subscription.objects.update_or_create(
            company=company,
            defaults={
                'plan': plan,
                'start_date': date.today(),
                'end_date': date.today() + timedelta(days=30),
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
    

