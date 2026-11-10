import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { analyticsConsent, track } from "./lib/analytics";
import "./styles.css";
// Shared estimates carry financial assumptions in the query string. Keep them
// usable as direct links while asking cooperative search crawlers not to index them.
if (window.location.search) {
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots) robots.content = "noindex,nofollow";
}
if (analyticsConsent()) track("app_opened");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
