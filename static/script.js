const CART_KEY = "quickbite-cart";

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = readCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("#cart-count").forEach((element) => {
    element.textContent = count;
  });
}

function money(value) {
  return `₹${Number(value).toFixed(2).replace(/\.00$/, "")}`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function loadMenu(search = "") {
  const container = document.getElementById("food-list");
  try {
    const items = await api(`/api/food?q=${encodeURIComponent(search)}`);
    container.innerHTML = "";
    if (items.length === 0) {
      showMessage("menu-message", "No dishes found. Try another search.");
      return;
    }
    showMessage("menu-message", "");
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "food-card";
      card.innerHTML = `
        <div class="food-art food-art-${index % 6}" aria-hidden="true">${["🍕", "🍔", "🍟", "🌯", "🍝", "🥤"][index % 6]}</div>
        <div class="food-card-content">
          <div class="food-meta"><span class="category-tag"></span><strong class="food-price"></strong></div>
          <h3 class="food-name"></h3><p class="food-description"></p>
          <button class="button button-primary add-to-cart">Add to cart <span aria-hidden="true">+</span></button>
        </div>`;
      card.querySelector(".category-tag").textContent = item.category;
      card.querySelector(".food-price").textContent = money(item.price);
      card.querySelector(".food-name").textContent = item.name;
      card.querySelector(".food-description").textContent = item.description;
      card.querySelector(".add-to-cart").addEventListener("click", () => {
        const cart = readCart();
        const existing = cart.find((entry) => entry.food_item_id === item.id);
        if (existing) existing.quantity += 1;
        else cart.push({ food_item_id: item.id, quantity: 1 });
        saveCart(cart);
        showMessage("menu-message", `${item.name} added to your cart.`);
      });
      container.appendChild(card);
    });
  } catch (error) {
    showMessage("menu-message", error.message, true);
  }
}

async function renderCart() {
  const container = document.getElementById("cart-items");
  const cart = readCart();
  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-state"><span>🛍️</span><h2>Your cart is empty</h2><p>Pick something delicious from our menu.</p><a class="button button-primary" href="/">Browse menu</a></div>';
    document.getElementById("checkout").hidden = true;
    return;
  }
  try {
    const food = await api("/api/food");
    const available = new Map(food.map((item) => [item.id, item]));
    const visibleCart = cart.filter((entry) => available.has(entry.food_item_id));
    if (visibleCart.length !== cart.length) saveCart(visibleCart);
    if (visibleCart.length === 0) return renderCart();
    container.innerHTML = "";
    let total = 0;
    visibleCart.forEach((entry) => {
      const item = available.get(entry.food_item_id);
      total += item.price * entry.quantity;
      const row = document.createElement("article");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-info"><span class="cart-emoji" aria-hidden="true">🍽️</span><div><h3 class="cart-item-name"></h3><p class="cart-item-price"></p></div></div>
        <div class="cart-item-actions"><div class="quantity-control"><button class="quantity-minus" aria-label="Decrease quantity">−</button><span class="quantity"></span><button class="quantity-plus" aria-label="Increase quantity">+</button></div><button class="remove-item">Remove</button></div>`;
      row.querySelector(".cart-item-name").textContent = item.name;
      row.querySelector(".cart-item-price").textContent = `${money(item.price)} each`;
      row.querySelector(".quantity").textContent = entry.quantity;
      row.querySelector(".quantity-minus").addEventListener("click", () => changeQuantity(entry.food_item_id, -1));
      row.querySelector(".quantity-plus").addEventListener("click", () => changeQuantity(entry.food_item_id, 1));
      row.querySelector(".remove-item").addEventListener("click", () => removeFromCart(entry.food_item_id));
      container.appendChild(row);
    });
    document.getElementById("cart-total").textContent = money(total);
  } catch (error) {
    showMessage("cart-message", error.message, true);
  }
}

function changeQuantity(foodId, change) {
  const cart = readCart();
  const item = cart.find((entry) => entry.food_item_id === foodId);
  if (item) item.quantity += change;
  saveCart(cart.filter((entry) => entry.quantity > 0));
  renderCart();
}

function removeFromCart(foodId) {
  saveCart(readCart().filter((entry) => entry.food_item_id !== foodId));
  renderCart();
}

async function placeOrder() {
  const customerName = document.getElementById("customer-name").value.trim();
  if (!customerName) {
    showMessage("cart-message", "Please enter your name.", true);
    return;
  }
  const button = document.getElementById("place-order");
  button.disabled = true;
  try {
    const result = await api("/api/cart/order", {
      method: "POST",
      body: JSON.stringify({ customer_name: customerName, items: readCart() }),
    });
    saveCart([]);
    document.getElementById("cart-items").innerHTML = `
      <div class="confirmation-card"><span aria-hidden="true">✅</span><p class="eyebrow">Order confirmed</p><h2>Thanks, ${escapeHtml(customerName)}!</h2>
      <p>Your order <strong>#${result.order_id}</strong> has been placed.</p><p>Total: <strong>${money(result.total_amount)}</strong></p>
      <a class="button button-primary" href="/orders">View your orders</a></div>`;
    document.getElementById("checkout").hidden = true;
    showMessage("cart-message", "");
  } catch (error) {
    showMessage("cart-message", error.message, true);
  } finally {
    button.disabled = false;
  }
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function renderOrderCards(orders, target, isAdmin = false) {
  target.innerHTML = "";
  if (orders.length === 0) {
    target.innerHTML = '<div class="empty-state compact"><h2>No orders yet</h2><p>Orders will appear here after checkout.</p></div>';
    return;
  }
  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-heading"><div><p class="eyebrow">Order #${order.id}</p><h3 class="order-customer"></h3></div><span class="status-badge"></span></div>
      <p class="order-date"></p><ul class="order-lines"></ul>
      <div class="order-total"><span>Total</span><strong>${money(order.total_amount)}</strong></div>
      ${isAdmin ? `<label class="field-label status-label" for="status-${order.id}">Update status</label><div class="inline-form"><select id="status-${order.id}" class="text-input status-select"><option>Pending</option><option>Preparing</option><option>Out for Delivery</option><option>Delivered</option><option>Cancelled</option></select><button class="button button-light update-status">Save</button></div>` : ""}`;
    card.querySelector(".order-customer").textContent = order.customer_name;
    card.querySelector(".status-badge").textContent = order.status;
    card.querySelector(".order-date").textContent = new Date(`${order.created_at.replace(" ", "T")}Z`).toLocaleString();
    const lines = card.querySelector(".order-lines");
    order.items.forEach((item) => {
      const line = document.createElement("li");
      line.textContent = `${item.name} × ${item.quantity}`;
      lines.appendChild(line);
    });
    if (isAdmin) {
      const select = card.querySelector(".status-select");
      select.value = order.status;
      card.querySelector(".update-status").addEventListener("click", async () => {
        try {
          await api(`/api/orders/${order.id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: select.value }),
          });
          showMessage("admin-message", `Order #${order.id} status updated.`);
          loadAdminOrders();
        } catch (error) {
          showMessage("admin-message", error.message, true);
        }
      });
    }
    target.appendChild(card);
  });
}

async function loadCustomerOrders(name) {
  try {
    const orders = await api(`/api/orders?customer_name=${encodeURIComponent(name)}`);
    renderOrderCards(orders, document.getElementById("orders-list"));
    showMessage("orders-message", orders.length ? "" : "No orders found for that name.");
  } catch (error) {
    showMessage("orders-message", error.message, true);
  }
}

async function loadAdminFood() {
  const container = document.getElementById("admin-food-list");
  try {
    const food = await api("/api/food");
    container.innerHTML = "";
    food.forEach((item) => {
      const row = document.createElement("div");
      row.className = "admin-food-row";
      row.innerHTML = '<div><strong class="admin-food-name"></strong><span class="admin-food-details"></span></div><button class="button button-danger">Delete</button>';
      row.querySelector(".admin-food-name").textContent = item.name;
      row.querySelector(".admin-food-details").textContent = `${item.category} · ${money(item.price)}`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!window.confirm(`Delete ${item.name}?`)) return;
        try {
          await api(`/api/food/${item.id}`, { method: "DELETE" });
          showMessage("admin-message", `${item.name} deleted.`);
          loadAdminFood();
        } catch (error) {
          showMessage("admin-message", error.message, true);
        }
      });
      container.appendChild(row);
    });
  } catch (error) {
    showMessage("admin-message", error.message, true);
  }
}

async function loadAdminOrders() {
  try {
    const orders = await api("/api/orders");
    renderOrderCards(orders, document.getElementById("admin-orders-list"), true);
  } catch (error) {
    showMessage("admin-message", error.message, true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  const page = document.body.dataset.page;
  if (page === "menu") {
    loadMenu();
    document.getElementById("food-search").addEventListener("input", (event) => loadMenu(event.target.value));
  }
  if (page === "cart") {
    renderCart();
    document.getElementById("place-order").addEventListener("click", placeOrder);
  }
  if (page === "orders") {
    document.getElementById("orders-search").addEventListener("submit", (event) => {
      event.preventDefault();
      loadCustomerOrders(document.getElementById("orders-name").value.trim());
    });
  }
  if (page === "admin") {
    loadAdminFood();
    loadAdminOrders();
    document.getElementById("refresh-orders").addEventListener("click", loadAdminOrders);
    document.getElementById("food-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const item = Object.fromEntries(form.entries());
      item.price = Number(item.price);
      try {
        await api("/api/food", { method: "POST", body: JSON.stringify(item) });
        event.currentTarget.reset();
        showMessage("admin-message", `${item.name} added to the menu.`);
        loadAdminFood();
      } catch (error) {
        showMessage("admin-message", error.message, true);
      }
    });
  }
});
