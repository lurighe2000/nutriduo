self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() ?? {};
  } catch {
    /* Show a visible fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(
      typeof message.title === "string"
        ? message.title.slice(0, 100)
        : "NutriDuo",
      {
        body:
          typeof message.body === "string"
            ? message.body.slice(0, 500)
            : "Un momento para registrar tu día.",
        tag:
          typeof message.tag === "string"
            ? message.tag.slice(0, 100)
            : "nutriduo-recordatorio",
        icon: new URL("icon-192-duo.png", self.registration.scope).href,
        badge: new URL("badge-duo.png", self.registration.scope).href,
        data: { url: self.registration.scope },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => client.url.startsWith(scope));
      if (existing) return existing.focus();
      return self.clients.openWindow(scope);
    })(),
  );
});
