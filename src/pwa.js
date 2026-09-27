export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Übernimmt ein neuer Service Worker, einmal neu laden, damit sofort die neue Version läuft
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });

  const register = () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch((error) => {
        console.warn("[BenchMarkPro] Service Worker Registrierung fehlgeschlagen:", error);
      });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
