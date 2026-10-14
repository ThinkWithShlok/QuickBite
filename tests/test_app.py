import pytest

from app import app
from database import init_db


@pytest.fixture
def client(tmp_path):
    app.config.update(TESTING=True, DATABASE=str(tmp_path / "test.db"))
    init_db(app.config["DATABASE"])
    with app.test_client() as test_client:
        yield test_client


def test_home_page_loads(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Quick" in response.data


def test_food_api_returns_sample_items(client):
    response = client.get("/api/food")
    assert response.status_code == 200
    assert len(response.get_json()) >= 6
    assert response.get_json()[0]["name"] == "Margherita Pizza"


def test_order_can_be_created_and_saved(client):
    food_id = client.get("/api/food").get_json()[0]["id"]
    response = client.post(
        "/api/cart/order",
        json={"customer_name": "Sam", "items": [{"food_item_id": food_id, "quantity": 2}]},
    )
    assert response.status_code == 201
    order_id = response.get_json()["order_id"]
    saved_order = client.get("/api/orders?customer_name=Sam").get_json()[0]
    assert saved_order["id"] == order_id
    assert saved_order["total_amount"] == 598
    assert saved_order["items"][0]["quantity"] == 2


def test_food_item_can_be_added(client):
    response = client.post(
        "/api/food",
        json={
            "name": "Veg Sandwich",
            "description": "Toasted with fresh vegetables.",
            "price": 129,
            "category": "Snacks",
        },
    )
    assert response.status_code == 201
    assert response.get_json()["name"] == "Veg Sandwich"


def test_admin_can_delete_food_and_update_order(client):
    food_id = client.get("/api/food").get_json()[0]["id"]
    order = client.post(
        "/api/cart/order",
        json={"customer_name": "Alex", "items": [{"food_item_id": food_id, "quantity": 1}]},
    ).get_json()
    deleted = client.delete(f"/api/food/{food_id}")
    updated = client.put(f"/api/orders/{order['order_id']}/status", json={"status": "Preparing"})
    assert deleted.status_code == 200
    assert updated.status_code == 200
    assert client.get("/api/orders").get_json()[0]["status"] == "Preparing"
