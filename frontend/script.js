const API_INVENTORY = 'http://localhost:20002';
const API_NOTIFICATIONS = 'http://localhost:20003';
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}

async function checkService(name, base) {
  const label = $(`#${name}-status`);
  const dot = $(`#${name}-dot`);
  try {
    await getJson(`${base}/health`);
    label.textContent = 'En línea'; dot.className = 'dot ok';
  } catch {
    label.textContent = 'No disponible'; dot.className = 'dot bad';
  }
}

async function loadProducts() {
  const body = $('#products-body');
  try {
    const products = await getJson(`${API_INVENTORY}/api/products`);
    if (!products.length) { body.innerHTML = '<tr><td colspan="4" class="empty">No hay productos registrados.</td></tr>'; return; }
    body.innerHTML = products.map((p) => `<tr><td>${safe(p.name)}<br><small class="muted">${safe(p.description || '')}</small></td><td>${safe(p.quantity)}</td><td>${money(p.price)}</td><td><button class="delete-button" data-delete="${safe(p.id)}" data-name="${safe(p.name)}">Eliminar</button></td></tr>`).join('');
  } catch (error) { body.innerHTML = `<tr><td colspan="4">No se pudieron cargar los productos: ${safe(error.message)}</td></tr>`; }
}

async function loadNotifications() {
  const list = $('#notifications-list');
  try {
    const notifications = await getJson(`${API_NOTIFICATIONS}/api/notifications?limit=30`);
    if (!notifications.length) { list.innerHTML = '<p class="empty">Todavía no hay notificaciones.</p>'; return; }
    list.innerHTML = notifications.map((n) => `<article class="notice ${safe(n.type)}"><strong>${safe(n.service)} · ${safe(n.type)}</strong><p>${safe(n.message)}</p><small>${safe(n.created_at ? new Date(n.created_at).toLocaleString('es-MX') : '')}</small></article>`).join('');
  } catch (error) { list.innerHTML = `<p class="empty">No se pudieron cargar las notificaciones: ${safe(error.message)}</p>`; }
}

$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  values.quantity = Number(values.quantity); values.price = Number(values.price);
  $('#product-message').textContent = 'Guardando producto…';
  try {
    await getJson(`${API_INVENTORY}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    form.reset(); form.elements.quantity.value = 1; form.elements.price.value = 0;
    $('#product-message').textContent = 'Producto registrado correctamente.';
    await Promise.all([loadProducts(), loadNotifications()]);
  } catch (error) { $('#product-message').textContent = `No se pudo registrar: ${error.message}`; }
});

$('#products-body').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  if (!confirm(`¿Eliminar el producto “${button.dataset.name}”?`)) return;
  try {
    await getJson(`${API_INVENTORY}/api/products/${button.dataset.delete}`, { method: 'DELETE' });
    $('#product-message').textContent = 'Producto eliminado.';
    await Promise.all([loadProducts(), loadNotifications()]);
  } catch (error) { $('#product-message').textContent = `No se pudo eliminar: ${error.message}`; }
});

$('#refresh-products').addEventListener('click', loadProducts);
$('#refresh-notifications').addEventListener('click', loadNotifications);
Promise.all([checkService('inventory', API_INVENTORY), checkService('notifications', API_NOTIFICATIONS), loadProducts(), loadNotifications()]);
setInterval(() => { checkService('inventory', API_INVENTORY); checkService('notifications', API_NOTIFICATIONS); }, 15000);
