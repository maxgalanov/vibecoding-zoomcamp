# Django Todo App

## Prerequisites
- Python 3.10+
- uv (or pip) to manage the virtualenv

## Setup
```bash
uv venv .venv
source .venv/bin/activate
uv pip install django
```

## Database
```bash
python manage.py makemigrations tasks
python manage.py migrate
```

## Tests
```bash
python manage.py test
```

## Run
```bash
python manage.py runserver
# open http://127.0.0.1:8000/
```
