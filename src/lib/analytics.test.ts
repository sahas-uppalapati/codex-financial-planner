import { afterEach, expect, it, vi } from "vitest";
import { disableAnalytics, enableAnalytics, track, trackVisit } from "./analytics";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("counts visits by default but drops usage events when consent is withdrawn", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {
    location: { origin: "https://example.com" },
    localStorage: {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
    },
  });
  vi.stubEnv("VITE_POSTHOG_KEY", "test-key");
  trackVisit();
  track("comparison_added");
  expect(enableAnalytics()).toBe(true);
  track("comparison_added");
  disableAnalytics();
  await vi.dynamicImportSettled();
  expect(sdk.capture).toHaveBeenCalledTimes(1);
  expect(sdk.capture).toHaveBeenCalledWith("$pageview");
  const clean = sdk.init.mock.calls[0][1].before_send;
  expect(clean({ properties: { $current_url: "https://example.com/?plan=private#secret" } }).properties.$current_url).toBe("https://example.com/");
});
