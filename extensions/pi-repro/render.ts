/**
 * Small helpers shared by the tools: building text tool-results and keeping the
 * live dashboard widget in sync. Tools rely on pi's default tool-call rendering,
 * so there are no custom TUI components here — just text and the widget.
 */
import type { AgentToolResult, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildWidgetLines } from "./dashboard.ts";
import { runtimeStore, sessionKey } from "./runtime.ts";

export const WIDGET_KEY = "pi-repro";

/** Build a plain-text tool result with optional structured details. */
export function textResult<T>(text: string, details: T): AgentToolResult<T> {
  return { content: [{ type: "text", text }], details };
}

/**
 * Recompute the widget from disk and show it (or clear it when there is no
 * active session). Safe to call after any state mutation.
 */
export function refreshWidget(ctx: ExtensionContext, root: string): void {
  if (!ctx.hasUI) return;
  const lines = buildWidgetLines(root);
  const rt = runtimeStore.ensure(sessionKey(ctx));
  if (lines.length === 0) {
    if (rt.widgetShown) {
      ctx.ui.setWidget(WIDGET_KEY, undefined);
      rt.widgetShown = false;
    }
    return;
  }
  ctx.ui.setWidget(WIDGET_KEY, lines);
  rt.widgetShown = true;
}
