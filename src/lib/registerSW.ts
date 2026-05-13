// Registers the service worker only in production AND outside iframes / Lovable preview hosts.
// In the editor preview the SW would cache stale builds and break HMR.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    // Clean up any leftover SW registrations so preview never serves cached shell
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  // Dynamically import the virtual module so dev preview never pulls it.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // virtual module unavailable in this build mode — safe to ignore
    });
}
