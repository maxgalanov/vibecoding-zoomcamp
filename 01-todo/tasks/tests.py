from datetime import date, timedelta

from django.contrib import admin
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .admin import TaskAdmin  # noqa: F401 - ensure admin registration
from .models import Task


class TaskViewTests(TestCase):
    def test_create_task_success(self):
        response = self.client.post(
            reverse("task_create"),
            {"title": "New task", "description": "Desc", "due_date": "2030-01-01"},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        task = Task.objects.get()
        self.assertEqual(task.title, "New task")
        self.assertEqual(task.description, "Desc")
        self.assertEqual(task.due_date, date(2030, 1, 1))
        self.assertFalse(task.is_completed)

    def test_create_task_validation_error(self):
        response = self.client.post(reverse("task_create"), {"description": "No title"})
        self.assertEqual(response.status_code, 200)
        form = response.context["form"]
        self.assertFalse(form.is_valid())
        self.assertIn("title", form.errors)
        self.assertEqual(Task.objects.count(), 0)

    def test_list_ordering_incomplete_first_then_due_date(self):
        now = timezone.now()
        first = Task.objects.create(
            title="No due incomplete", due_date=None, is_completed=False
        )
        second = Task.objects.create(
            title="Due soon incomplete",
            due_date=date.today() + timedelta(days=1),
            is_completed=False,
        )
        third = Task.objects.create(
            title="Completed later",
            due_date=date.today() - timedelta(days=1),
            is_completed=True,
        )
        # Control created_at for deterministic ordering
        first.created_at = now - timedelta(days=2)
        first.save(update_fields=["created_at"])
        second.created_at = now - timedelta(days=1)
        second.save(update_fields=["created_at"])
        third.created_at = now
        third.save(update_fields=["created_at"])

        response = self.client.get(reverse("task_list"))
        self.assertEqual(response.status_code, 200)
        tasks = list(response.context["tasks"])
        self.assertEqual([t.title for t in tasks], [
            "No due incomplete",
            "Due soon incomplete",
            "Completed later",
        ])

    def test_list_filter_active(self):
        Task.objects.create(title="Active task", is_completed=False)
        Task.objects.create(title="Done task", is_completed=True)
        response = self.client.get(reverse("task_list"), {"status": "active"})
        self.assertEqual(response.status_code, 200)
        titles = [t.title for t in response.context["tasks"]]
        self.assertEqual(titles, ["Active task"])

    def test_list_filter_completed(self):
        Task.objects.create(title="Active task", is_completed=False)
        Task.objects.create(title="Done task", is_completed=True)
        response = self.client.get(reverse("task_list"), {"status": "completed"})
        self.assertEqual(response.status_code, 200)
        titles = [t.title for t in response.context["tasks"]]
        self.assertEqual(titles, ["Done task"])

    def test_update_task(self):
        task = Task.objects.create(title="Old", description="Old desc")
        response = self.client.post(
            reverse("task_update", args=[task.pk]),
            {"title": "New", "description": "New desc", "is_completed": "on"},
        )
        self.assertEqual(response.status_code, 302)
        task.refresh_from_db()
        self.assertEqual(task.title, "New")
        self.assertEqual(task.description, "New desc")
        self.assertTrue(task.is_completed)

    def test_delete_task(self):
        task = Task.objects.create(title="To delete")
        response = self.client.post(reverse("task_delete", args=[task.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())

    def test_toggle_done(self):
        task = Task.objects.create(title="Toggle me", is_completed=False)
        response = self.client.post(reverse("task_toggle_done", args=[task.pk]))
        self.assertEqual(response.status_code, 302)
        task.refresh_from_db()
        self.assertTrue(task.is_completed)

    def test_due_date_optional(self):
        response = self.client.post(
            reverse("task_create"),
            {"title": "No due", "description": "", "due_date": ""},
        )
        self.assertEqual(response.status_code, 302)
        task = Task.objects.get()
        self.assertIsNone(task.due_date)


class TaskAdminTests(TestCase):
    def test_task_is_registered_in_admin(self):
        self.assertIn(Task, admin.site._registry)
        admin_instance = admin.site._registry[Task]
        self.assertEqual(
            admin_instance.list_display, ("title", "due_date", "is_completed", "created_at")
        )
        self.assertEqual(admin_instance.list_filter, ("is_completed", "due_date"))
        self.assertEqual(admin_instance.search_fields, ("title", "description"))
