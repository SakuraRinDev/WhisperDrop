import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n";
import type { AudioDevice, OllamaModel, PullEvent, VocabEntry } from "../types";
import { useSettings } from "../hooks/useSettings";
import { useTauriEvent } from "../hooks/useTauriEvent";
import { SettingsTab } from "./settings/SettingsTab";
import { ModelsTab } from "./settings/ModelsTab";
import { DictionaryTab } from "./settings/DictionaryTab";
import { AdvancedTab } from "./settings/AdvancedTab";
import { VocabularyModal } from "./settings/VocabularyModal";

type TabKey = "settings" | "models" | "dictionary" | "advanced";

function buildVocabularyPrompt(entries: VocabEntry[]): string {
  const parts = entries
    .filter((e) => e.word.trim())
    .map((e) => (e.reading.trim() ? `${e.word}（${e.reading}）` : e.word));
  return parts.length > 0 ? `${parts.join("、")}について話しています。` : "";
}

function SettingsPanel() {
  const { settings, save, update } = useSettings();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
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

  // Fetch devices and models on mount
  useTauriEvent("sidecar-ready", () => {
    invoke("list_audio_devices").catch(() => {});
    invoke("list_ollama_models").catch(() => {});
  });
  useState(() => {
    invoke("list_audio_devices").catch(() => {});
    invoke("list_ollama_models").catch(() => {});
  });

  const tabs: { key: TabKey; i18n: Parameters<typeof t>[0] }[] = [
    { key: "settings", i18n: "tab.settings" },
    { key: "models", i18n: "tab.models" },
    { key: "dictionary", i18n: "tab.dictionary" },
    { key: "advanced", i18n: "section.advanced" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="flex items-center mb-6 border-b pb-px" style={{ borderColor: "var(--border-card)" }}>
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
            className="text-base leading-none transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Toggle theme"
          >
            {settings.theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </nav>

      {tab === "settings" && <SettingsTab settings={settings} devices={devices} locale={L} update={update} />}
      {tab === "models" && <ModelsTab ollamaModels={ollamaModels} pulling={pulling} locale={L} />}
      {tab === "dictionary" && <DictionaryTab settings={settings} locale={L} onEditVocab={() => setVocabOpen(true)} />}
      {tab === "advanced" && <AdvancedTab settings={settings} ollamaModels={ollamaModels} locale={L} update={update} save={save} />}

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
