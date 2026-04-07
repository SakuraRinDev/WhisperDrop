import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n";
import type { AudioDevice, OllamaModel, PullEvent, VocabEntry } from "../types";
import { useSettings } from "../hooks/useSettings";
import { useHistory } from "../hooks/useHistory";
import { useTauriEvent } from "../hooks/useTauriEvent";
import { SettingsTab } from "./settings/SettingsTab";
import { ModelsTab } from "./settings/ModelsTab";
import { DictionaryTab } from "./settings/DictionaryTab";
import { AdvancedTab } from "./settings/AdvancedTab";
import { HistoryTab } from "./settings/HistoryTab";
import { UsageTab } from "./settings/UsageTab";
import { VocabularyModal } from "./settings/VocabularyModal";

type TabKey = "settings" | "usage" | "models" | "dictionary" | "advanced" | "history";

function buildVocabularyPrompt(entries: VocabEntry[]): string {
  const parts = entries
    .filter((e) => e.word.trim())
    .map((e) => (e.reading.trim() ? `${e.word}（${e.reading}）` : e.word));
  return parts.length > 0 ? `${parts.join("、")}について話しています。` : "";
}

function SettingsPanel() {
  const { settings, save, update } = useSettings();
  const history = useHistory();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; version: string | null }>({ connected: false, version: null });
  const [pulling, setPulling] = useState<Record<string, { percent: number; status: string }>>({});
  const [vocabOpen, setVocabOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("settings");

  const L = settings.locale;

  useTauriEvent<{ devices?: AudioDevice[] }>("devices-list", (event) => {
    if (event.payload.devices) setDevices(event.payload.devices);
  });
  useTauriEvent<{ models?: OllamaModel[] }>("ollama-models", (event) => {
    if (event.payload.models) setOllamaModels(event.payload.models);
  });
  useTauriEvent<{ connected?: boolean; version?: string | null }>("ollama-status", (event) => {
    setOllamaStatus({ connected: event.payload.connected ?? false, version: event.payload.version ?? null });
  });
  useTauriEvent<PullEvent>("ollama-pull", (event) => {
    const { status, model, percent, pull_status, message } = event.payload;
    if (!model) return;
    if (status === "pull_start") {
      setPulling((p) => ({ ...p, [model]: { percent: 0, status: "starting..." } }));
    } else if (status === "pull_progress") {
      setPulling((p) => ({ ...p, [model]: { percent: percent ?? 0, status: pull_status ?? "" } }));
    } else if (status === "pull_complete") {
      setPulling((p) => { const next = { ...p }; delete next[model]; return next; });
    } else if (status === "pull_error") {
      setPulling((p) => ({ ...p, [model]: { percent: 0, status: `Error: ${message}` } }));
      setTimeout(() => setPulling((p) => { const next = { ...p }; delete next[model]; return next; }), 5000);
    }
  });

  // Save transcription to history
  useTauriEvent<{ text?: string; language?: string; duration_ms?: number }>(
    "transcription-done",
    (event) => {
      const { text, language, duration_ms } = event.payload;
      if (text && text.trim()) {
        history.addEntry(text, language ?? null, duration_ms ?? null);
      }
    }
  );

  // Fetch devices and models on mount
  useTauriEvent("sidecar-ready", () => {
    invoke("list_audio_devices").catch(() => {});
    invoke("list_ollama_models").catch(() => {});
    invoke("check_ollama").catch(() => {});
  });
  useState(() => {
    invoke("list_audio_devices").catch(() => {});
    invoke("list_ollama_models").catch(() => {});
    invoke("check_ollama").catch(() => {});
  });

  const tabs: { key: TabKey; i18n: Parameters<typeof t>[0] }[] = [
    { key: "settings", i18n: "tab.settings" },
    { key: "usage", i18n: "tab.usage" },
    { key: "history", i18n: "tab.history" },
    { key: "models", i18n: "tab.models" },
    { key: "dictionary", i18n: "tab.dictionary" },
    { key: "advanced", i18n: "section.advanced" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <nav className="flex items-center mb-6 border-b pb-px shrink-0" style={{ borderColor: "var(--border-card)" }}>
        <div className="flex gap-6 flex-1">
          {tabs.map(({ key, i18n }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="font-display pb-2 text-[15px] font-medium tracking-wide transition-colors"
              style={{
                color: tab === key ? "var(--text-primary)" : "var(--text-faint)",
                borderBottom: tab === key ? "2px solid var(--text-primary)" : "2px solid transparent",
              }}
            >
              {t(i18n, L)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2">
          <button
            onClick={() => update("locale", L === "en" ? "ja" : "en")}
            className="font-sans text-xs px-2 py-1 rounded transition-colors"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-input)" }}
            title="Toggle language"
          >
            {L === "en" ? "JP" : "EN"}
          </button>
          <button
            onClick={() => update("theme", settings.theme === "light" ? "dark" : "light")}
            className="leading-none transition-colors"
            style={{ color: "var(--text-faint)" }}
            title="Toggle theme"
          >
            {settings.theme === "light" ? (
              <svg className="w-4 h-4" style={{ color: "#c4a86a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" style={{ color: "#c4a86a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {tab === "history" ? (
        <HistoryTab
          entries={history.entries}
          loading={history.loading}
          locale={L}
          onCopy={(text) => {
            navigator.clipboard?.writeText(text);
          }}
          onDelete={history.deleteEntry}
          onClearAll={history.clearAll}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "settings" && <SettingsTab settings={settings} devices={devices} locale={L} update={update} />}
          {tab === "usage" && <UsageTab locale={L} />}
          {tab === "models" && <ModelsTab ollamaModels={ollamaModels} ollamaStatus={ollamaStatus} pulling={pulling} locale={L} />}
          {tab === "dictionary" && <DictionaryTab settings={settings} locale={L} onEditVocab={() => setVocabOpen(true)} />}
          {tab === "advanced" && <AdvancedTab settings={settings} ollamaModels={ollamaModels} locale={L} update={update} save={save} />}
        </div>
      )}

      {vocabOpen && (
        <VocabularyModal
          entries={settings.vocabularyEntries}
          locale={L}
          onClose={(entries) => {
            setVocabOpen(false);
            if (entries) {
              save({ ...settings, vocabularyEntries: entries, customVocabulary: buildVocabularyPrompt(entries) });
            }
          }}
        />
      )}
    </div>
  );
}

export default SettingsPanel;
