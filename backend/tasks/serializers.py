from rest_framework import serializers
from django.utils import timezone
from django.db.models.query import QuerySet
from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'priority', 'due_date',
            'completed', 'completed_at', 'created_at', 'created_by'
        ]
        read_only_fields = ['completed_at', 'created_at', 'created_by']

    def get_extra_kwargs(self):
        extra_kwargs = super().get_extra_kwargs()

        if (
            self.instance
            and not isinstance(self.instance, QuerySet)
            and getattr(self.instance, 'completed', False)
        ):
            for field in ['title', 'priority', 'due_date']:
                extra_kwargs.setdefault(field, {})
                extra_kwargs[field]['read_only'] = True

        return extra_kwargs

    def validate(self, data):
        if self.instance and self.instance.completed:

            forbidden_fields = ['title', 'priority', 'due_date']
            for field in forbidden_fields:
                if field in self.initial_data:         
                    raise serializers.ValidationError({
                        "detail": "Completed tasks cannot be edited."
                    })

            if self.initial_data.get('completed') is False:
                raise serializers.ValidationError({
                    "completed": "You cannot undo a completed task. Once finished, it stays completed forever."
                })

        due_date = data.get('due_date')
        if due_date and due_date < timezone.now().date():
            raise serializers.ValidationError({
                "due_date": "Due date cannot be in the past."
            })

        return data

    def update(self, instance, validated_data):
        if validated_data.get('completed') is True and not instance.completed:
            validated_data['completed_at'] = timezone.now()

        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data.pop("completed", None)   
        validated_data['created_by'] = self.context['request'].user
        validated_data['company'] = self.context['request'].user.company
        return super().create(validated_data)