/**
 * Tägliche Erinnerung (Android-PWA).
 * - Beim Öffnen: Banner, wenn die Uhrzeit vorbei ist und heute nichts eingetragen wurde.
 * - Im Hintergrund: Periodic Background Sync (nur installierte PWA in Chrome, Zeitpunkt bestimmt Android).
 *   Der Service Worker liest dafür einen kleinen Status aus dem Cache, weil er keinen Zugriff auf localStorage hat.
 */
const META_CACHE = "benchmark-pro-meta";
const META_URL = "./__reminder.json";

export function isDue(settings, loggedToday, now = new Date()) {
  if (!settings?.reminder?.enabled || loggedToday) return false;
  const [h, m] = String(settings.reminder.time || "18:30").split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

/** Schreibt den Status für den Service Worker. lastLogged: letzter Tag mit Einheit (YYYY-MM-DD). */
export async function syncReminderState(settings, lastLogged) {
  try {
    if (!("caches" in window)) return;
    const cache = await caches.open(META_CACHE);
    const prev = await cache.match(META_URL).then((r) => (r ? r.json() : {})).catch(() => ({}));
    const body = JSON.stringify({ enabled: !!settings.reminder.enabled, time: settings.reminder.time, lastLogged, lastNotified: prev.lastNotified || null });
    await cache.put(META_URL, new Response(body, { headers: { "Content-Type": "application/json" } }));
  } catch (e) {
    console.warn("[BenchMarkPro] Erinnerungsstatus nicht gespeichert:", e);
  }
}

/** Fragt die Berechtigung an und registriert den Hintergrund-Check. Liefert eine Statusmeldung. */
export async function enableReminder() {
  if (typeof Notification === "undefined") return "Dieses Gerät unterstützt keine Benachrichtigungen. Nutze den Kalendertermin.";
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return "Ohne Erlaubnis für Benachrichtigungen erinnert dich die App nur beim Öffnen.";
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "periodicSync" in reg) {
      const status = await navigator.permissions.query({ name: "periodic-background-sync" }).catch(() => null);
      if (!status || status.state === "granted") {
        await reg.periodicSync.register("bmp-reminder", { minInterval: 6 * 60 * 60 * 1000 });
        return "Erinnerung ist an.";
      }
    }
    return "Erinnerung ist an. Im Hintergrund klappt sie nur, wenn die App auf dem Startbildschirm installiert ist.";
  } catch {
    return "Erinnerung ist an. Im Hintergrund klappt sie nur, wenn die App auf dem Startbildschirm installiert ist.";
  }
}

export async function disableReminder() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "periodicSync" in reg) await reg.periodicSync.unregister("bmp-reminder");
  } catch { /* ignorieren */ }
}
