from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Company
from .serializers import CompanyPlanSerializer


class CompanyPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        default_data = {
            "plan_name": "No Plan",
            "max_members": 0,
            "members_used": 0,
            "remaining_members": 0,
            "days_remaining": 0,
        }

        try:
            company = Company.objects.filter(owner=request.user).first()

            if not company:
                raise AttributeError("No company found")

            subscription = getattr(company, 'subscription', None)

            if not subscription:
                data = default_data
            else:
                plan = getattr(subscription, 'plan', None)

                data = {
                    "plan_name": plan.name if plan else "No Plan",
                    "max_members": plan.user_limit if plan else 0,
                    "members_used": getattr(subscription, 'members_usage', 0),
                    "remaining_members": getattr(subscription, 'members_remaining', 0),
                    "days_remaining": getattr(subscription, 'days_remaining', 0),
                }

        except Exception: 
            data = default_data

        serializer = CompanyPlanSerializer(data)
        return Response(serializer.data)