export function $(sel, root=document){ return root.querySelector(sel); }
export function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

export function setActiveTab(tabName){
  $all(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tabName));
  $all(".panel").forEach(p => p.classList.toggle("is-active", p.id === `tab-${tabName}`));
}

export function clearElement(el){
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function createNode(tagName, { className = "", text = "", attrs = {} } = {}){
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (text) el.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    el.setAttribute(key, String(value));
  }
  return el;
}

let toastRoot = null;

function ensureToastRoot() {
  if (toastRoot && document.body.contains(toastRoot)) return toastRoot;
  toastRoot = document.createElement("div");
  toastRoot.className = "toast-root";
  toastRoot.setAttribute("aria-live", "polite");
  toastRoot.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function toast(msg, { type = "info", duration = 2400 } = {}){
  const root = ensureToastRoot();
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = String(msg || "");
  root.appendChild(item);

  requestAnimationFrame(() => item.classList.add("is-visible"));

  window.setTimeout(() => {
    item.classList.remove("is-visible");
    window.setTimeout(() => item.remove(), 220);
  }, duration);
}
