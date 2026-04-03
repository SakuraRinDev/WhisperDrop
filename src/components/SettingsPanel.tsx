import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";
import { t, type Locale } from "../i18n";

interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  sample_rate: number;
  default: boolean;
}

interface OllamaModel {
  name: string;
  description: string;
  size_label: string;
  installed: boolean;
  recommended: boolean;
}

interface PullEvent {
  status: string;
  model?: string;
  percent?: number;
  pull_status?: string;
  message?: string;
}

interface VocabEntry {
  word: string;
  reading: string;
}

type Theme = "light" | "dark";

interface Settings {
  transcriptionMode: "local" | "cloud";
  whisperModel: string;
  language: string;
  llmPostprocess: boolean;
  llmProvider: "none" | "claude" | "openai" | "ollama";
  claudeApiKey: string;
  openaiApiKey: string;
  ollamaModel: string;
  ollamaUrl: string;
  vadThreshold: number;
  silenceDuration: number;
  inputDevice: number | null;
  customVocabulary: string;
  vocabularyEntries: VocabEntry[];
  locale: Locale;
  theme: Theme;
}

const DEFAULT_SETTINGS: Settings = {
  transcriptionMode: "local",
  whisperModel: "large-v3-turbo",
  language: "auto",
  llmPostprocess: false,
  llmProvider: "none",
  claudeApiKey: "",
  openaiApiKey: "",
  ollamaModel: "qwen2.5:1.5b",
  ollamaUrl: "http://localhost:11434",
  vadThreshold: 0.5,
  silenceDuration: 1.5,
  inputDevice: null,
  customVocabulary: "",
  vocabularyEntries: [],
  locale: "en",
  theme: "light",
};

function buildVocabularyPrompt(entries: VocabEntry[]): string {
  if (entries.length === 0) return "";
  const parts = entries
    .filter((e) => e.word.trim())
    .map((e) => (e.reading.trim() ? `${e.word}（${e.reading}）` : e.word));
  if (parts.length === 0) return "";
  return `${parts.join("、")}について話しています。`;
}

const MODEL_OPTIONS = [
  { value: "tiny", label: "tiny", desc: "Fastest, lower accuracy" },
  { value: "base", label: "base", desc: "Good balance (recommended for CPU)" },
  { value: "small", label: "small", desc: "Better accuracy" },
  { value: "medium", label: "medium", desc: "High accuracy" },
  { value: "large-v3-turbo", label: "large-v3-turbo", desc: "Best speed/accuracy (recommended for GPU)" },
  { value: "large-v3", label: "large-v3", desc: "Highest accuracy" },
];

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
];

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [pulling, setPulling] = useState<Record<string, { percent: number; status: string }>>({});
  const [vocabOpen, setVocabOpen] = useState(false);
  const [tab, setTab] = useState<"settings" | "models" | "dictionary" | "advanced">("settings");

  const L = settings.locale;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const sendConfigToSidecar = async (s: Settings) => {
    await invoke("send_sidecar_config", {
      config: {
        mode: s.transcriptionMode,
        model: s.whisperModel,
        language: s.language === "auto" ? null : s.language,
        llm_postprocess: s.llmPostprocess,
        llm_provider: s.llmProvider,
        claude_api_key: s.claudeApiKey || null,
        openai_api_key: s.openaiApiKey || null,
        vad_threshold: s.vadThreshold,
        silence_duration: s.silenceDuration,
        input_device: s.inputDevice,
        custom_vocabulary: s.customVocabulary,
        ollama_model: s.ollamaModel,
        ollama_url: s.ollamaUrl,
      },
    }).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      try {
        const store = await Store.load("settings.json");
        const stored = await store.get<Settings>("settings");
        const merged = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
        setSettings(merged);
        await sendConfigToSidecar(merged);
      } catch {
        await sendConfigToSidecar(DEFAULT_SETTINGS);
      }
    })();
  }, []);

  useEffect(() => {
    const unlisten = listen<{ devices?: AudioDevice[] }>("devices-list", (event) => {
      if (event.payload.devices) {
        setDevices(event.payload.devices);
      }
    });
    invoke("list_audio_devices").catch(() => {});
    return () => { unlisten.then((f) => f()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ models?: OllamaModel[] }>("ollama-models", (event) => {
      if (event.payload.models) {
        setOllamaModels(event.payload.models);
      }
    });
    invoke("list_ollama_models").catch(() => {});
    return () => { unlisten.then((f) => f()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<PullEvent>("ollama-pull", (event) => {
      const { status, model, percent, pull_status, message } = event.payload;
      if (!model) return;
      if (status === "pull_start") {
        setPulling((p) => ({ ...p, [model]: { percent: 0, status: "starting..." } }));
      } else if (status === "pull_progress") {
        setPulling((p) => ({
          ...p,
          [model]: { percent: percent ?? 0, status: pull_status ?? "" },
        }));
      } else if (status === "pull_complete") {
        setPulling((p) => {
          const next = { ...p };
          delete next[model];
          return next;
        });
      } else if (status === "pull_error") {
        setPulling((p) => ({
          ...p,
          [model]: { percent: 0, status: `Error: ${message}` },
        }));
        setTimeout(() => {
          setPulling((p) => {
            const next = { ...p };
            delete next[model];
            return next;
          });
        }, 5000);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const save = async (newSettings: Settings) => {
    setSettings(newSettings);
    try {
      const store = await Store.load("settings.json");
      await store.set("settings", newSettings);
      await store.save();
      await sendConfigToSidecar(newSettings);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    save({ ...settings, [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab Navigation + Toggles */}
      <nav className="flex items-center mb-6 border-b pb-px" style={{ borderColor: "var(--border-card)" }}>
        <div className="flex gap-6 flex-1">
          {([
          { key: "settings" as const, i18n: "tab.settings" as const },
          { key: "models" as const, i18n: "tab.models" as const },
          { key: "dictionary" as const, i18n: "tab.dictionary" as const },
          { key: "advanced" as const, i18n: "section.advanced" as const },
          ]).map(({ key, i18n }) => (
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

      {tab === "settings" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Transcription Mode */}
      <Section title={t("section.transcription", L)}>
        <Label text={t("label.mode", L)}>
          <select
            value={settings.transcriptionMode}
            onChange={(e) => update("transcriptionMode", e.target.value as "local" | "cloud")}
            className="input-field"
          >
            <option value="local">{t("opt.local", L)}</option>
            <option value="cloud">{t("opt.cloud", L)}</option>
          </select>
        </Label>

        {settings.transcriptionMode === "local" && (
          <Label text={t("label.model", L)}>
            <select
              value={settings.whisperModel}
              onChange={(e) => update("whisperModel", e.target.value)}
              className="input-field"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
          </Label>
        )}

        <Label text={t("label.language", L)}>
          <select
            value={settings.language}
            onChange={(e) => update("language", e.target.value)}
            className="input-field"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Label>
      </Section>

      {/* Microphone */}
      <Section title={t("section.mic", L)}>
        <Label text={t("label.inputDevice", L)}>
          <div className="flex gap-2">
            <select
              value={settings.inputDevice ?? ""}
              onChange={(e) => update("inputDevice", e.target.value === "" ? null : parseInt(e.target.value))}
              className="input-field flex-1"
            >
              <option value="">System Default</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.default ? " (default)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => invoke("list_audio_devices").catch(() => {})}
              className="btn-secondary !px-3 !py-2 text-sm"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </Label>
      </Section>

      </div>
      )}

      {tab === "models" && (
      <div>
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
                      onClick={() =>
                        invoke("pull_ollama_model", { model: m.name }).catch(() => {})
                      }
                      className="btn-primary text-xs !px-3 !py-1.5"
                    >
                      DL
                    </button>
                  )}
                  {m.installed && (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
      )}

      {tab === "dictionary" && (
      <div>
      <Section title={t("section.vocabulary", L)}>
        <p className="text-xs -mt-2 mb-3" style={{ color: "var(--text-faint)" }}>
          {t("vocab.desc", L)}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {settings.vocabularyEntries.length > 0
              ? t("vocab.registered", L, { n: settings.vocabularyEntries.filter((e) => e.word.trim()).length })
              : t("vocab.none", L)}
          </p>
          <button onClick={() => setVocabOpen(true)} className="btn-secondary text-sm">
            {t("vocab.edit", L)}
          </button>
        </div>
        {settings.customVocabulary && (
          <p className="text-xs mt-2 truncate" style={{ color: "var(--text-faint)" }}>
            Prompt: {settings.customVocabulary}
          </p>
        )}
      </Section>
      </div>
      )}

      {tab === "advanced" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* LLM Post-processing */}
      <Section title={t("section.llm", L)} wide>
        <Label text={t("label.enable", L)}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.llmPostprocess}
              onChange={(e) => update("llmPostprocess", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("llm.desc", L)}
            </span>
          </label>
        </Label>

        {settings.llmPostprocess && (
          <>
            {ollamaModels.length === 0 && (
              <div className="p-3 rounded-lg text-sm space-y-2" style={{ background: "var(--alert-amber-bg)", border: "1px solid var(--alert-amber-border)" }}>
                <p className="font-medium" style={{ color: "var(--alert-amber-text)" }}>{t("llm.noOllama", L)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("llm.installOllama", L)}
                </p>
                <div className="flex gap-2 items-center">
                  <a
                    href="https://ollama.com/download"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    ollama.com/download
                  </a>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>→ {t("afterInstall", L)}</span>
                  <button
                    onClick={() => invoke("list_ollama_models").catch(() => {})}
                    className="btn-secondary ml-auto text-xs !px-2 !py-1"
                  >
                    ↻
                  </button>
                </div>
              </div>
            )}

            {ollamaModels.length > 0 && ollamaModels.filter((m) => m.installed).length === 0 && (
              <div className="p-3 rounded-lg text-sm space-y-1" style={{ background: "var(--alert-blue-bg)", border: "1px solid var(--alert-blue-border)" }}>
                <p className="font-medium" style={{ color: "var(--alert-blue-text)" }}>{t("llm.noModel", L)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("llm.dlModel", L)}
                </p>
              </div>
            )}

            <Label text={t("llm.model", L)}>
              <div className="flex gap-2">
                <select
                  value={settings.llmProvider === "ollama" ? `ollama:${settings.ollamaModel}` : settings.llmProvider}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("ollama:")) {
                      const model = val.slice(7);
                      save({ ...settings, llmProvider: "ollama", ollamaModel: model });
                    } else {
                      update("llmProvider", val as "claude" | "openai");
                    }
                  }}
                  className="input-field flex-1"
                >
                  <optgroup label="Local (Ollama)">
                    {ollamaModels.filter((m) => m.installed).length === 0 && (
                      <option value={`ollama:${settings.ollamaModel}`}>
                        {settings.ollamaModel} (未インストール)
                      </option>
                    )}
                    {ollamaModels
                      .filter((m) => m.installed)
                      .map((m) => (
                        <option key={m.name} value={`ollama:${m.name}`}>
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Cloud API">
                    <option value="claude">Claude (Cloud)</option>
                    <option value="openai">OpenAI GPT (Cloud)</option>
                  </optgroup>
                </select>
                <button
                  onClick={() => invoke("list_ollama_models").catch(() => {})}
                  className="btn-secondary !px-3 !py-2 text-sm"
                  title="Refresh"
                >
                  ↻
                </button>
              </div>
            </Label>

            {settings.llmProvider === "ollama" && (
              <Label text="Ollama URL">
                <input
                  type="text"
                  value={settings.ollamaUrl}
                  onChange={(e) => update("ollamaUrl", e.target.value)}
                  placeholder="http://localhost:11434"
                  className="input-field"
                />
              </Label>
            )}
          </>
        )}
      </Section>

      <Section title={t("section.apiKeys", L)}>
        <Label text="Claude API Key">
          <input
            type="password"
            value={settings.claudeApiKey}
            onChange={(e) => update("claudeApiKey", e.target.value)}
            placeholder="sk-ant-..."
            className="input-field"
          />
        </Label>
        <Label text="OpenAI API Key">
          <input
            type="password"
            value={settings.openaiApiKey}
            onChange={(e) => update("openaiApiKey", e.target.value)}
            placeholder="sk-..."
            className="input-field"
          />
        </Label>
      </Section>

      <Section title="VAD / Silence">
        <Label text={`VAD Threshold: ${settings.vadThreshold}`}>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={settings.vadThreshold}
            onChange={(e) => update("vadThreshold", parseFloat(e.target.value))}
            className="w-full"
          />
        </Label>
        <Label text={`Silence Duration: ${settings.silenceDuration}s`}>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.25"
            value={settings.silenceDuration}
            onChange={(e) => update("silenceDuration", parseFloat(e.target.value))}
            className="w-full"
          />
        </Label>
      </Section>
      </div>
      )}

      {vocabOpen && (
        <VocabularyModal
          entries={settings.vocabularyEntries}
          locale={L}
          onClose={(entries) => {
            setVocabOpen(false);
            if (entries) {
              const prompt = buildVocabularyPrompt(entries);
              save({ ...settings, vocabularyEntries: entries, customVocabulary: prompt });
            }
          }}
        />
      )}

    </div>
  );
}

function Section({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`card space-y-4 ${wide ? "lg:col-span-2" : ""}`}
    >
      <h2
        className="font-display text-[15px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--text-section)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[15px] font-medium" style={{ color: "var(--text-secondary)" }}>{text}</label>
      {children}
    </div>
  );
}

function VocabularyModal({
  entries: initialEntries,
  onClose,
  locale,
}: {
  entries: VocabEntry[];
  onClose: (entries: VocabEntry[] | null) => void;
  locale: Locale;
}) {
  const [rows, setRows] = useState<VocabEntry[]>(() =>
    initialEntries.length > 0 ? [...initialEntries] : [{ word: "", reading: "" }],
  );

  const updateRow = (idx: number, field: keyof VocabEntry, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { word: "", reading: "" }]);

  const removeRow = (idx: number) => {
    setRows((prev) => (prev.length <= 1 ? [{ word: "", reading: "" }] : prev.filter((_, i) => i !== idx)));
  };

  return (
    <div className="modal-backdrop" onClick={() => onClose(null)}>
      <div
        className="card shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-card)" }}>
          <h3 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            {locale === "ja" ? "辞書登録" : "Dictionary"}
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            {t("vocab.desc", locale)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>{t("vocab.word", locale)}</span>
            <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>{t("vocab.reading", locale)}</span>
            <span />
          </div>
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-2">
              <input
                type="text"
                value={row.word}
                onChange={(e) => updateRow(idx, "word", e.target.value)}
                placeholder="Sakura Rin"
                className="input-field text-sm"
              />
              <input
                type="text"
                value={row.reading}
                onChange={(e) => updateRow(idx, "reading", e.target.value)}
                placeholder="さくらりん"
                className="input-field text-sm"
              />
              <button
                onClick={() => removeRow(idx)}
                className="flex items-center justify-center hover:text-red-400 transition-colors"
                style={{ color: "var(--text-faint)" }}
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors mt-1"
          >
            {t("vocab.addRow", locale)}
          </button>
        </div>

        <div className="px-5 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid var(--border-card)" }}>
          <button onClick={() => onClose(null)} className="btn-secondary text-sm">
            {t("vocab.cancel", locale)}
          </button>
          <button
            onClick={() => onClose(rows.filter((r) => r.word.trim()))}
            className="btn-primary text-sm"
          >
            {t("vocab.save", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
