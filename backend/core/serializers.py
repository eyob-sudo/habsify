from rest_framework import serializers


class CompanyPlanSerializer(serializers.Serializer):
    plan_name = serializers.CharField()
    max_members = serializers.IntegerField()
    members_used = serializers.IntegerField()
    remaining_members = serializers.IntegerField()
    days_remaining = serializers.IntegerField()