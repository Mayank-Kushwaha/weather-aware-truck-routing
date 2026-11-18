import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { HEALTH_URL } from "@/api";
import "@/styles/index.css";

// Start downloading the map chunk now; it loads in parallel with the app shell instead of after it.
void import("@/components/map/MapView");
// Wake the (free-tier) backend as early as possible; the welcome modal shows the status.
void fetch(HEALTH_URL, { cache: "no-store" }).catch(() => undefined);
// The guide is rarely needed at once; fetch it when the browser is idle so it opens instantly.
const idle =
  (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
  ((cb: () => void) => setTimeout(cb, 2000));
idle(() => void import("@/components/modals/GuideModal"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
