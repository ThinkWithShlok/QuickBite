# QuickBite – Food Delivery Management System

A small food ordering app built for an Agile and DevOps practical. Customers can browse a menu, manage a cart, place orders and look up order history. The basic admin page manages menu items and order status.

## Features

- Search a menu seeded with sample dishes and INR prices
- Add, update and remove cart items; place and track orders
- Admin can add/delete menu items, view orders and update order status
- SQLite database is created and populated automatically

## Tech stack

Python, Flask, SQLite (`sqlite3`), HTML, CSS, vanilla JavaScript and pytest.

## Project structure

```text
QuickBite/
├── app.py
├── database.py
├── requirements.txt
├── templates/       # Menu, cart, orders and admin pages
├── static/          # CSS and JavaScript
└── tests/            # pytest tests
```

## Install and run

Open this folder in VS Code, then in the integrated terminal run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5000>. SQLite creates `quickbite.db` automatically the first time the app starts. No login is required for the simple admin page at `/admin`.

## Run tests

```powershell
pytest
```
