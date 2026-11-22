import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { trackVisit } from "./lib/analytics";
import "@fontsource-variable/inter";
import "./styles.css";
import { ThemeProvider } from "./components/ThemeProvider";
// Shared estimates carry financial assumptions in the query string. Keep them
// usable as direct links while asking cooperative search crawlers not to index them.
if (window.location.search) {
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots) robots.content = "noindex,nofollow";
}
trackVisit();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
