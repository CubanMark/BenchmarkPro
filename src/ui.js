export function qs(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}
export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
export function setText(el, value) {
  el.textContent = String(value ?? "");
}
export function setActiveTab(tabKey) {
  qsa(".tab").forEach(btn => btn.classList.toggle("is-active", btn.dataset.tab === tabKey));
  qsa(".panel").forEach(p => p.classList.remove("is-active"));
  const panel = document.getElementById(`tab-${tabKey}`);
  if (panel) panel.classList.add("is-active");
}
