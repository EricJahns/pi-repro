/**
 * Per-session runtime state. Reproduction state itself lives on disk under
 * `.repro/`; this store only holds ephemeral UI bookkeeping so we avoid
 * redundant widget updates.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readConfig } from "./config.ts";
import { reproPaths } from "./paths.ts";

export interface ReproRuntime {
  /** Whether the live widget is currently displayed for this session. */
  widgetShown: boolean;
}

function createRuntimeStore() {
  const store = new Map<string, ReproRuntime>();
  return {
    ensure(key: string): ReproRuntime {
      let rt = store.get(key);
      if (!rt) {
        rt = { widgetShown: false };
        store.set(key, rt);
      }
      return rt;
    },
    drop(key: string): void {
      store.delete(key);
    },
  };
}

export const runtimeStore = createRuntimeStore();

/**
 * Resolve the project root used for `.repro/`. Honors `workingDir` from the
 * session config when present, otherwise falls back to the current cwd.
 */
export function resolveRoot(ctx: ExtensionContext): string {
  const config = readConfig(reproPaths(ctx.cwd).config);
  return config?.workingDir ?? ctx.cwd;
}

/** Stable per-session key (cwd is sufficient since `.repro/` is per-project). */
export function sessionKey(ctx: ExtensionContext): string {
  return ctx.cwd;
}
