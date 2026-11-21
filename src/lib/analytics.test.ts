import { afterEach, expect, it, vi } from "vitest";
import { disableAnalytics, enableAnalytics, track } from "./analytics";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: sdk }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("drops pending events when consent is withdrawn before the SDK loads", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
    },
  });
  vi.stubEnv("VITE_POSTHOG_KEY", "test-key");

  expect(enableAnalytics()).toBe(true);
  track("comparison_added");
  disableAnalytics();
  await vi.dynamicImportSettled();

  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
});
