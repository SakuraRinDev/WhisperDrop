import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { t, type Locale } from "../../i18n";
import type { OllamaModel } from "../../types";
import { Section } from "../ui/Section";

interface Props {
  ollamaModels: OllamaModel[];
  ollamaStatus: { connected: boolean; version: string | null };
  pulling: Record<string, { percent: number; status: string }>;
  locale: Locale;
}

export function ModelsTab({ ollamaModels, ollamaStatus, pulling, locale: L }: Props) {
  return (
    <div className="space-y-4">
      <Section title="Ollama">
        {ollamaStatus.connected ? (
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-success)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {t("ollama.connected", L)}
            </span>
            {ollamaStatus.version && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-faint)", background: "var(--bg-input)" }}>
                v{ollamaStatus.version}
              </span>
            )}
            <button
              onClick={() => invoke("check_ollama").catch(() => {})}
              className="ml-auto text-xs hover:underline"
              style={{ color: "var(--text-link, #3b82f6)" }}
            >
              ↻
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-danger)" }} />
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("ollama.notInstalled", L)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => open("https://ollama.com/download")}
                className="btn-primary text-xs !px-3 !py-1.5"
              >
                {t("ollama.install", L)}
              </button>
              <button
                onClick={() => { invoke("check_ollama").catch(() => {}); invoke("list_ollama_models").catch(() => {}); }}
                className="btn-secondary text-xs !px-3 !py-1.5"
              >
                {t("ollama.checkConnection", L)}
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title={t("section.ollamaModels", L)}>
        <p className="text-xs -mt-2 mb-2" style={{ color: "var(--text-faint)" }}>
          {t("ollama.desc", L)}
        </p>
        <div className="space-y-2">
          {ollamaModels.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("ollama.notConnected", L)}
              <button
                onClick={() => invoke("list_ollama_models").catch(() => {})}
                className="ml-2 text-blue-500 hover:underline"
              >
                {t("ollama.retry", L)}
              </button>
            </p>
          )}
          {ollamaModels.map((m) => {
            const isPulling = pulling[m.name] != null;
            const pullInfo = pulling[m.name];
            return (
              <div
                key={m.name}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                style={{ border: "1px solid var(--border-card)" }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block" style={{ color: "var(--text-primary)" }}>
                    {m.name}
                  </span>
                  {m.description && (
                    <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>{m.description}</p>
                  )}
                  {m.size_label && !m.installed && (
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>{m.size_label}</p>
                  )}
                  {m.warning && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--accent-warn)" }}>
                      {m.warning}
                    </p>
                  )}
                  {isPulling && pullInfo && (
                    <div className="mt-1.5">
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-card)" }}>
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.min(pullInfo.percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                        {pullInfo.status} {pullInfo.percent > 0 ? `${pullInfo.percent}%` : ""}
                      </p>
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {!m.installed && !isPulling && (
                    <button
                      onClick={() => invoke("pull_ollama_model", { model: m.name }).catch(() => {})}
                      className="btn-primary text-xs !px-3 !py-1.5"
                    >
                      DL
                    </button>
                  )}
                  {m.installed && !m.warning && (
                    <svg className="w-5 h-5" style={{ color: "var(--accent-success)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {m.installed && m.warning && (
                    <svg className="w-5 h-5" style={{ color: "var(--accent-warn)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                  {isPulling && (
                    <span className="text-xs animate-pulse" style={{ color: "var(--text-faint)" }}>{t("ollama.downloading", L)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
