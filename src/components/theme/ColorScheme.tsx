"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Client-side color-scheme wiring.
 *
 * The root <html> carries `data-theme="dark"` when the effective scheme is dark,
 * which flips the `:root[data-theme="dark"]` CSS token block in globals.css.
 * `suppressHydrationWarning` on <html> avoids the mismatch warning during SSR.
 *
 * Storage key: "flowdesk.colorScheme" (values: "light" | "dark" | "system").
 * When set to "system", the theme follows `prefers-color-scheme`.
 *
 * Unlike a naive localStorage read, this module also listens for a custom
 * "flowdesk-theme-change" event so that other client components (e.g. the
 * sidebar toggle) can flip the theme without a full page reload.
 */
const STORAGE_KEY = "flowdesk.colorScheme";

export type ColorScheme = "light" | "dark" | "system";

const COLOR_SCHEME_OPTIONS: readonly ColorScheme[] = ["light", "dark", "system"];

function readStoredScheme(): ColorScheme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && COLOR_SCHEME_OPTIONS.includes(raw as ColorScheme)) {
      return raw as ColorScheme;
    }
  } catch {
    // ignore storage errors
  }
  return "system";
}

function effectiveScheme(storageScheme: ColorScheme): "light" | "dark" {
  if (storageScheme === "system") {
    if (typeof window === "undefined" || !window.matchMedia) {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return storageScheme === "dark" ? "dark" : "light";
}

function applyThemeTag(effective: "light" | "dark") {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  if (effective === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
}

function syncThemeFromStorage() {
  if (typeof document === "undefined") return;
  const stored = readStoredScheme();
  const eff = effectiveScheme(stored);
  applyThemeTag(eff);
}

/**
 * Subscribes to every source that can change the color scheme: the in-app
 * toggle (custom event), other tabs (storage event) and, for the effective
 * scheme, the OS preference (matchMedia).
 */
function subscribeScheme(callback: () => void): () => void {
  window.addEventListener("flowdesk-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("flowdesk-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function subscribeEffective(callback: () => void): () => void {
  const unsubscribe = subscribeScheme(callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) {
    mq.addEventListener("change", callback);
  } else {
    mq.addListener(callback);
  }
  return () => {
    unsubscribe();
    if (mq.removeEventListener) {
      mq.removeEventListener("change", callback);
    } else {
      mq.removeListener(callback);
    }
  };
}

/**
 * Pure hook that returns the stored color-scheme value. Exposed for UI toggles.
 *
 * HYDRATION SAFETY: `useSyncExternalStore` renders the server snapshot
 * ("system") during SSR and hydration, so the first client render always
 * matches the server HTML. The real stored value is picked up on the first
 * client snapshot after hydration, and updates when the toggle fires, when
 * another tab changes the preference, or when a navigation happens.
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeScheme, readStoredScheme, () => "system");
}

/**
 * Effective (actual rendered) scheme, derived from stored + system preference.
 *
 * HYDRATION SAFETY: renders the server snapshot ("light") during SSR and
 * hydration so the first client render matches the server HTML exactly. The
 * real value (stored preference + OS preference) is computed on the first
 * client snapshot after hydration, and re-computed whenever the toggle, another
 * tab, or the OS preference changes.
 */
export function useEffectiveScheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeEffective,
    () => effectiveScheme(readStoredScheme()),
    () => "light",
  );
}

/** Server-safe effective-scheme getter for the root layout (SSR-safe). */
export function getColorScheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }
  return effectiveScheme(readStoredScheme());
}

/**
 * Programmatically set the theme. Writes to localStorage and dispatches a
 * custom event so every listener (including ColorSchemeScript) flips immediately
 * without a page reload.
 */
export function setColorScheme(scheme: ColorScheme) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, scheme);
  window.dispatchEvent(
    new CustomEvent("flowdesk-theme-change", { detail: scheme }),
  );
}

/**
 * Client component placed in <head> so the browser picks a scheme early.
 * Keeps `<html>[data-theme=...]` in sync with the stored preference,
 * `prefers-color-scheme` when the stored value is "system", and any external
 * theme change (from the sidebar toggle or another tab).
 */
export function ColorSchemeScript() {
  const [scheme, setScheme] = useState<ColorScheme>(readStoredScheme);

  // Initial sync on mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    syncThemeFromStorage();
  }, []);

  // Keep <html> in sync whenever the stored scheme changes internally.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const eff = effectiveScheme(scheme);
    applyThemeTag(eff);
  }, [scheme]);

  // React to external changes (sidebar toggle, other tabs via storage event).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onCustomEvent = (e: Event) => {
      const ce = e as CustomEvent<ColorScheme>;
      if (ce.detail && COLOR_SCHEME_OPTIONS.includes(ce.detail)) {
        setScheme(ce.detail);
      }
    };

    const onStorage = (e: StorageEvent) => {
      // Another tab changed the theme — pick it up here too.
      if (e.key === STORAGE_KEY && e.newValue && COLOR_SCHEME_OPTIONS.includes(e.newValue as ColorScheme)) {
        setScheme(e.newValue as ColorScheme);
      }
    };

    const onSystemChange = () => {
      // OS preference changed while we're in "system" mode — re-derive.
      setScheme(readStoredScheme());
    };

    window.addEventListener("flowdesk-theme-change", onCustomEvent);
    window.addEventListener("storage", onStorage);

    if (scheme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) {
        mq.addEventListener("change", onSystemChange);
      } else {
        // Safari <14 fallback
        mq.addListener(onSystemChange);
      }
    }

    return () => {
      window.removeEventListener("flowdesk-theme-change", onCustomEvent);
      window.removeEventListener("storage", onStorage);
      if (scheme === "system") {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq.removeEventListener) {
          mq.removeEventListener("change", onSystemChange);
        } else {
          mq.removeListener(onSystemChange);
        }
      }
    };
  }, [scheme]);

  // UA color-scheme meta (affects native scrollbars, form controls, flash prevention).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.querySelector(
      'meta[name="color-scheme"]',
    ) as HTMLMetaElement | null;
    const eff = effectiveScheme(scheme);
    if (meta) {
      meta.content = `${eff === "dark" ? "dark" : "light"}`;
    } else {
      const m = document.createElement("meta");
      m.name = "color-scheme";
      m.content = `${eff === "dark" ? "dark" : "light"}`;
      document.head.appendChild(m);
    }
  }, [scheme]);

  return null;
}
