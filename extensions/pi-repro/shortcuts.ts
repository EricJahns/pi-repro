/**
 * Keyboard shortcut configuration.
 *
 * The fullscreen dashboard shortcut defaults to ctrl+r ("reproduction") and can
 * be overridden with the PI_REPRO_SHORTCUT environment variable, or disabled
 * entirely by setting it to an empty string or "none".
 */
import type { KeyId } from "@earendil-works/pi-tui";

export interface ShortcutConfig {
  /** Open the fullscreen reproduction dashboard. `undefined` disables it. */
  fullscreenDashboard?: KeyId;
}

const DEFAULT_FULLSCREEN: KeyId = "ctrl+r";

export function loadShortcuts(): ShortcutConfig {
  const override = process.env.PI_REPRO_SHORTCUT?.trim();
  if (override === undefined) return { fullscreenDashboard: DEFAULT_FULLSCREEN };
  if (override === "" || override.toLowerCase() === "none") return {};
  return { fullscreenDashboard: override as KeyId };
}
