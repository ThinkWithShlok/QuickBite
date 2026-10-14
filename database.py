import sqlite3
from pathlib import Path

from flask import current_app, g

SAMPLE_FOOD = [
    ("Margherita Pizza", "Classic pizza with tomato, mozzarella and basil.", 299, "Pizza", ""),
    ("Veg Burger", "Crispy vegetable patty with fresh lettuce and sauce.", 149, "Burgers", ""),
    ("French Fries", "Golden, crispy fries with a pinch of seasoning.", 99, "Sides", ""),
    ("Paneer Wrap", "Spiced paneer, crunchy vegetables and mint chutney.", 179, "Wraps", ""),
    ("Creamy Pasta", "Penne pasta in a creamy herb sauce.", 229, "Pasta", ""),
    ("Cold Coffee", "Chilled coffee blended with milk.", 119, "Drinks", ""),
]


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(database_path=None):
    path = database_path or current_app.config["DATABASE"]
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS food_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            image_url TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            food_item_id INTEGER,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE SET NULL
        );
        """
    )
    food_count = db.execute("SELECT COUNT(*) FROM food_items").fetchone()[0]
    if food_count == 0:
        db.executemany(
            """
            INSERT INTO food_items (name, description, price, category, image_url)
            VALUES (?, ?, ?, ?, ?)
            """,
            SAMPLE_FOOD,
        )
    db.commit()
    db.close()
