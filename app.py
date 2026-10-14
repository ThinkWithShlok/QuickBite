import math
import sqlite3

from flask import Flask, jsonify, render_template, request

from database import close_db, get_db, init_db

app = Flask(__name__)
app.config["DATABASE"] = "quickbite.db"
app.json.sort_keys = False
app.teardown_appcontext(close_db)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/cart")
def cart():
    return render_template("cart.html")


@app.get("/orders")
def orders_page():
    return render_template("orders.html")


@app.get("/admin")
def admin():
    return render_template("admin.html")


@app.get("/api/food")
def list_food():
    search = request.args.get("q", "").strip()
    db = get_db()
    food = db.execute(
        """
        SELECT id, name, description, price, category, image_url
        FROM food_items
        WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
        ORDER BY id
        """,
        (f"%{search}%", f"%{search}%", f"%{search}%"),
    ).fetchall()
    return jsonify([dict(item) for item in food])


@app.post("/api/food")
def add_food():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    category = str(data.get("category", "")).strip()
    image_url = str(data.get("image_url", "")).strip()
    try:
        price = float(data.get("price"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid price."}), 400

    if not name or not description or not category or not math.isfinite(price) or price <= 0:
        return jsonify({"error": "Name, description, category and a positive price are required."}), 400

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO food_items (name, description, price, category, image_url)
        VALUES (?, ?, ?, ?, ?)
        """,
        (name, description, price, category, image_url),
    )
    db.commit()
    item = db.execute("SELECT * FROM food_items WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(dict(item)), 201


@app.delete("/api/food/<int:food_id>")
def delete_food(food_id):
    db = get_db()
    cursor = db.execute("DELETE FROM food_items WHERE id = ?", (food_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Food item not found."}), 404
    return jsonify({"message": "Food item deleted."})


@app.get("/api/orders")
def list_orders():
    customer_name = request.args.get("customer_name", "").strip()
    db = get_db()
    if customer_name:
        rows = db.execute(
            "SELECT * FROM orders WHERE customer_name = ? COLLATE NOCASE ORDER BY created_at DESC, id DESC",
            (customer_name,),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM orders ORDER BY created_at DESC, id DESC").fetchall()

    result = []
    for row in rows:
        order = dict(row)
        order["items"] = [
            dict(item)
            for item in db.execute(
                """
                SELECT COALESCE(food_items.name, 'Removed item') AS name,
                       order_items.quantity, order_items.price
                FROM order_items
                LEFT JOIN food_items ON food_items.id = order_items.food_item_id
                WHERE order_items.order_id = ?
                """,
                (row["id"],),
            ).fetchall()
        ]
        result.append(order)
    return jsonify(result)


@app.post("/api/cart/order")
def create_order():
    data = request.get_json(silent=True) or {}
    customer_name = str(data.get("customer_name", "")).strip()
    items = data.get("items")
    if not customer_name:
        return jsonify({"error": "Enter your name to place an order."}), 400
    if not isinstance(items, list) or not items:
        return jsonify({"error": "Your cart is empty."}), 400

    db = get_db()
    order_items = []
    total_amount = 0
    try:
        for item in items:
            food_id = int(item["food_item_id"])
            quantity = int(item["quantity"])
            if quantity < 1:
                raise ValueError
            food = db.execute("SELECT id, price FROM food_items WHERE id = ?", (food_id,)).fetchone()
            if food is None:
                return jsonify({"error": f"Food item {food_id} is no longer available."}), 400
            price = food["price"]
            total_amount += price * quantity
            order_items.append((food_id, quantity, price))
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Cart items must have a valid food item ID and quantity."}), 400

    try:
        cursor = db.execute(
            "INSERT INTO orders (customer_name, total_amount, status) VALUES (?, ?, 'Pending')",
            (customer_name, total_amount),
        )
        order_id = cursor.lastrowid
        db.executemany(
            "INSERT INTO order_items (order_id, food_item_id, quantity, price) VALUES (?, ?, ?, ?)",
            [(order_id, food_id, quantity, price) for food_id, quantity, price in order_items],
        )
        db.commit()
    except sqlite3.Error:
        db.rollback()
        raise

    return jsonify(
        {"message": "Order placed successfully.", "order_id": order_id, "total_amount": total_amount}
    ), 201


@app.put("/api/orders/<int:order_id>/status")
def update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    allowed_statuses = {"Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"}
    if not isinstance(status, str) or status not in allowed_statuses:
        return jsonify({"error": "Choose a valid order status."}), 400

    db = get_db()
    cursor = db.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Order not found."}), 404
    return jsonify({"message": "Order status updated.", "status": status})


if __name__ == "__main__":
    init_db(app.config["DATABASE"])
    app.run(debug=True)
