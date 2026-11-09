import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";

const CONSENT_KEY = "careerworth:analytics-consent";
let initialized = false;

export function analyticsConfigured() {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY);
}

export function analyticsConsent() {
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

function initialize() {
  if (initialized || !analyticsConfigured()) return;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
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
  initialized = true;
}

export function enableAnalytics() {
  if (!analyticsConfigured()) return false;
  try {
    window.localStorage.setItem(CONSENT_KEY, "yes");
  } catch {
    return false;
  }
  initialize();
  posthog.opt_in_capturing();
  posthog.capture("analytics_consent_granted");
  return true;
}

export function disableAnalytics() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // The opt-out still applies to this page if storage is unavailable.
  }
  posthog.opt_out_capturing();
  posthog.reset();
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
  initialize();
  posthog.capture(event, properties);
}
