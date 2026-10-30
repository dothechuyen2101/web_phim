// Service worker của web: chỉ hiện thông báo tập mới (Web Push).
// Không cache trang hay dữ liệu — danh sách phim luôn lấy mới từ server.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Tập mới", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Chỉ mở đường dẫn trong chính web này
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const tab = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (tab) {
        await tab.focus();
        // navigate() chỉ dùng được với tab do service worker này điều khiển
        if (await tab.navigate(url).catch(() => null)) return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
