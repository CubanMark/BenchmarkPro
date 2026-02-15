// JavaScript zur Steuerung der Tabs
function setupTabs() {
  // Gehe alle Tabs durch und füge Event-Listener hinzu
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      // Entferne die "is-active"-Klasse von allen Tabs
      $all(".tab").forEach(tab => tab.classList.remove("is-active"));
      // Setze die "is-active"-Klasse für den angeklickten Tab
      btn.classList.add("is-active");

      // Verstecke alle Panels
      $all(".panel").forEach(panel => panel.classList.remove("is-active"));

      // Zeige das entsprechende Panel für den angeklickten Tab an
      const targetTab = document.querySelector(`#tab-${btn.dataset.tab}`);
      if (targetTab) {
        targetTab.classList.add("is-active");
      } else {
        console.error("Ziel-Tab-Inhalt nicht gefunden!");
      }
    });
  });
}

// Initialisiere die Tabs, wenn das Fenster geladen ist
window.onload = function() {
  setupTabs();
};
