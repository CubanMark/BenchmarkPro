export function $(sel, root=document){ return root.querySelector(sel); }
export function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

export function setActiveTab(tabName){
  $all(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tabName));
  $all(".panel").forEach(p => p.classList.toggle("is-active", p.id === `tab-${tabName}`));
}

export function toast(msg){
  alert(msg);
}
