import type { CaptureResult, PostHog } from "posthog-js";

const CONSENT_KEY = "careerworth:analytics-consent";
let posthogClient: PostHog | null = null;
let posthogPromise: Promise<PostHog | null> | null = null;
let optedOut = false;

export function analyticsConfigured() {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY);
}

export function analyticsConsent() {
  if (optedOut) return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

function cleanUrlProperties(event: CaptureResult): CaptureResult {
  const properties = event.properties;
  for (const [key, value] of Object.entries(event.properties)) {
    if (!/(url|referrer)/i.test(key) || typeof value !== "string") continue;
    try {
      const url = new URL(value, window.location.origin);
      url.search = "";
      url.hash = "";
      properties[key] = url.toString();
    } catch {
      delete properties[key];
    }
  }
  return event;
}

async function getPostHog(): Promise<PostHog | null> {
  if (posthogClient) return posthogClient;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return null;
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then(({ default: posthog }) => {
      if (!analyticsConsent()) return null;
      posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
        autocapture: false,
        capture_exceptions: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_feature_flags: true,
        ip: false,
        persistence: "memory",
        person_profiles: "never",
        before_send: cleanUrlProperties,
      });
      posthogClient = posthog;
      return posthog;
    }).catch(() => null).finally(() => {
      posthogPromise = null;
    });
  }
  return posthogPromise;
}

export function enableAnalytics() {
  if (!analyticsConfigured()) return false;
  try {
    window.localStorage.setItem(CONSENT_KEY, "yes");
  } catch {
    return false;
  }
  optedOut = false;
  void getPostHog().then((client) => {
    if (!client || !analyticsConsent()) return;
    client.opt_in_capturing();
    client.capture("analytics_consent_granted");
  });
  return true;
}

export function disableAnalytics() {
  optedOut = true;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // The opt-out still applies to this page if storage is unavailable.
  }
  if (posthogClient) {
    posthogClient.opt_out_capturing();
    posthogClient.reset();
  }
}

export function track(
  event:
    | "app_opened"
    | "view_mode_changed"
    | "comparison_added"
    | "share_link_created"
    | "csv_exported",
  properties?: Record<string, string>,
) {
  if (!analyticsConsent() || !analyticsConfigured()) return;
  void getPostHog().then((client) => {
    if (analyticsConsent()) client?.capture(event, properties);
  });
}
