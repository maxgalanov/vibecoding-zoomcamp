from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "due_date", "is_completed", "created_at")
    list_filter = ("is_completed", "due_date")
    search_fields = ("title", "description")
    ordering = ("is_completed", "due_date", "-created_at")
