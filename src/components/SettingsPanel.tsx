import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";

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
  const [saved, setSaved] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [pulling, setPulling] = useState<Record<string, { percent: number; status: string }>>({});
  const [vocabOpen, setVocabOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const store = await Store.load("settings.json");
        const stored = await store.get<Settings>("settings");
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
      } catch {
        // Use defaults
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

      // Send config to sidecar
      await invoke("send_sidecar_config", {
        config: {
          mode: newSettings.transcriptionMode,
          model: newSettings.whisperModel,
          language: newSettings.language === "auto" ? null : newSettings.language,
          llm_postprocess: newSettings.llmPostprocess,
          llm_provider: newSettings.llmProvider,
          claude_api_key: newSettings.claudeApiKey || null,
          openai_api_key: newSettings.openaiApiKey || null,
          vad_threshold: newSettings.vadThreshold,
          silence_duration: newSettings.silenceDuration,
          input_device: newSettings.inputDevice,
          custom_vocabulary: newSettings.customVocabulary,
          ollama_model: newSettings.ollamaModel,
          ollama_url: newSettings.ollamaUrl,
        },
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    save({ ...settings, [key]: value });
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Transcription Mode */}
      <Section title="Transcription">
        <Label text="Mode">
          <select
            value={settings.transcriptionMode}
            onChange={(e) => update("transcriptionMode", e.target.value as "local" | "cloud")}
            className="input-field"
          >
            <option value="local">Local (faster-whisper)</option>
            <option value="cloud">Cloud (OpenAI Whisper API)</option>
          </select>
        </Label>

        {settings.transcriptionMode === "local" && (
          <Label text="Model">
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

        <Label text="Language">
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

      {/* Custom Vocabulary */}
      <Section title="Custom Vocabulary">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            {settings.vocabularyEntries.length > 0
              ? `${settings.vocabularyEntries.filter((e) => e.word.trim()).length} 件登録済み`
              : "未登録"}
          </p>
          <button
            onClick={() => setVocabOpen(true)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            辞書を編集
          </button>
        </div>
        {settings.customVocabulary && (
          <p className="text-xs text-white/30 mt-1 truncate">
            Prompt: {settings.customVocabulary}
          </p>
        )}
      </Section>

      {vocabOpen && (
        <VocabularyModal
          entries={settings.vocabularyEntries}
          onClose={(entries) => {
            setVocabOpen(false);
            if (entries) {
              const prompt = buildVocabularyPrompt(entries);
              save({ ...settings, vocabularyEntries: entries, customVocabulary: prompt });
            }
          }}
        />
      )}

      {/* LLM Post-processing */}
      <Section title="LLM Post-processing">
        <Label text="Enable">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.llmPostprocess}
              onChange={(e) => update("llmPostprocess", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-white/70">
              LLMでフィラー除去・句読点修正・漢字補正を追加で行う
            </span>
          </label>
        </Label>

        {settings.llmPostprocess && (
          <>
            <Label text="モデル">
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
                        {settings.ollamaModel} (Local)
                      </option>
                    )}
                    {ollamaModels
                      .filter((m) => m.installed)
                      .map((m) => (
                        <option key={m.name} value={`ollama:${m.name}`}>
                          {m.name} (Local)
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
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
                  title="Ollamaモデル一覧を更新"
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

      {/* Ollama Model Manager */}
      <Section title="Ollama Models">
        <p className="text-xs text-white/40 -mt-2 mb-2">
          モデルの管理・ダウンロード。<code className="text-white/50">sidecar/ollama_models.json</code> を編集して推奨モデルを追加できます。
        </p>
        <div className="space-y-2">
          {ollamaModels.length === 0 && (
            <p className="text-sm text-white/50">
              Ollama未接続、または読み込み中…
              <button
                onClick={() => invoke("list_ollama_models").catch(() => {})}
                className="ml-2 text-blue-400 hover:underline"
              >
                再取得
              </button>
            </p>
          )}
          {ollamaModels.map((m) => {
            const isPulling = pulling[m.name] != null;
            const pullInfo = pulling[m.name];
            return (
              <div
                key={m.name}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  m.installed ? "bg-white/5" : "bg-white/[0.02]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white/90 truncate block">
                    {m.name}
                  </span>
                  {m.description && (
                    <p className="text-xs text-white/40 truncate">{m.description}</p>
                  )}
                  {m.size_label && !m.installed && (
                    <p className="text-xs text-white/30">{m.size_label}</p>
                  )}
                  {isPulling && pullInfo && (
                    <div className="mt-1.5">
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.min(pullInfo.percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-white/40 mt-0.5">
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
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
                    >
                      DL
                    </button>
                  )}
                  {m.installed && (
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isPulling && (
                    <span className="text-xs text-white/40 animate-pulse">DL中…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
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

      {/* Microphone */}
      <Section title="Microphone">
        <Label text="Input Device">
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
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
              title="Refresh device list"
            >
              ↻
            </button>
          </div>
        </Label>
      </Section>

      {/* Advanced */}
      <Section title="Advanced">
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

      {saved && (
        <div className="text-center text-green-400 text-sm animate-pulse">
          Settings saved
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white/80">{text}</label>
      {children}
    </div>
  );
}

function VocabularyModal({
  entries: initialEntries,
  onClose,
}: {
  entries: VocabEntry[];
  onClose: (entries: VocabEntry[] | null) => void;
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
        className="bg-[#1a1a2e] rounded-2xl shadow-2xl border border-white/10 w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-base font-semibold text-white/90">辞書登録</h3>
          <p className="text-xs text-white/40 mt-1">
            単語/名前と読みを登録すると、Whisperの認識精度が向上します。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-2">
            <span className="text-xs text-white/50 font-medium">単語・名前</span>
            <span className="text-xs text-white/50 font-medium">読み（任意）</span>
            <span />
          </div>
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-2">
              <input
                type="text"
                value={row.word}
                onChange={(e) => updateRow(idx, "word", e.target.value)}
                placeholder="辻稜大"
                className="input-field text-sm"
              />
              <input
                type="text"
                value={row.reading}
                onChange={(e) => updateRow(idx, "reading", e.target.value)}
                placeholder="つじりょうた"
                className="input-field text-sm"
              />
              <button
                onClick={() => removeRow(idx)}
                className="flex items-center justify-center text-white/30 hover:text-red-400 transition-colors"
                title="削除"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1"
          >
            + 行を追加
          </button>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={() => onClose(null)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onClose(rows.filter((r) => r.word.trim()))}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
