from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from .forms import TaskForm
from .models import Task


def task_list(request):
    status = request.GET.get("status", "all")
    tasks = Task.objects.all()
    if status == "active":
        tasks = tasks.filter(is_completed=False)
    elif status == "completed":
        tasks = tasks.filter(is_completed=True)

    form = TaskForm()
    return render(
        request,
        "tasks/task_list.html",
        {"tasks": tasks, "form": form, "status": status},
    )


def task_create(request):
    if request.method == "POST":
        form = TaskForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("task_list")
    else:
        form = TaskForm()
    return render(request, "tasks/task_form.html", {"form": form, "action": "Create"})


def task_update(request, pk: int):
    task = get_object_or_404(Task, pk=pk)
    if request.method == "POST":
        form = TaskForm(request.POST, instance=task)
        if form.is_valid():
            form.save()
            return redirect("task_list")
    else:
        form = TaskForm(instance=task)
    return render(
        request,
        "tasks/task_form.html",
        {"form": form, "action": "Update", "task": task},
    )


def task_delete(request, pk: int):
    task = get_object_or_404(Task, pk=pk)
    if request.method == "POST":
        task.delete()
        return redirect("task_list")
    return render(request, "tasks/task_confirm_delete.html", {"task": task})


def task_toggle_done(request, pk: int):
    task = get_object_or_404(Task, pk=pk)
    task.is_completed = not task.is_completed
    task.save(update_fields=["is_completed", "updated_at"])
    return redirect(
        request.META.get("HTTP_REFERER", reverse("task_list"))
    )
