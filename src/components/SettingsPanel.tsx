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
};

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
  const [ollamaModels, setOllamaModels] = useState<{ name: string }[]>([]);

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
    const unlisten = listen<{ models?: { name: string }[] }>("ollama-models", (event) => {
      if (event.payload.models) {
        setOllamaModels(event.payload.models);
      }
    });
    invoke("list_ollama_models").catch(() => {});
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
        <Label text="Vocabulary / Prompt">
          <textarea
            value={settings.customVocabulary}
            onChange={(e) => update("customVocabulary", e.target.value)}
            placeholder={"例: WhisperDrop、Tauri、React、TypeScript、音声認識"}
            rows={4}
            className="input-field resize-y"
          />
        </Label>
        <p className="text-xs text-white/40">
          認識させたい固有名詞・専門用語を入力してください。Whisperの認識精度が向上します。
        </p>
      </Section>

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
              LLMでフィラー除去・句読点修正・漢字補正を行う
            </span>
          </label>
        </Label>

        {settings.llmPostprocess && (
          <>
            <Label text="Provider">
              <select
                value={settings.llmProvider}
                onChange={(e) => update("llmProvider", e.target.value as "none" | "claude" | "openai" | "ollama")}
                className="input-field"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="claude">Claude (Cloud)</option>
                <option value="openai">OpenAI GPT (Cloud)</option>
              </select>
            </Label>

            {settings.llmProvider === "ollama" && (
              <>
                <Label text="Ollama Model">
                  <div className="flex gap-2">
                    <select
                      value={settings.ollamaModel}
                      onChange={(e) => update("ollamaModel", e.target.value)}
                      className="input-field flex-1"
                    >
                      {ollamaModels.length === 0 && (
                        <option value={settings.ollamaModel}>{settings.ollamaModel}</option>
                      )}
                      {ollamaModels.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => invoke("list_ollama_models").catch(() => {})}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
                      title="Refresh model list"
                    >
                      ↻
                    </button>
                  </div>
                </Label>
                <Label text="Ollama URL">
                  <input
                    type="text"
                    value={settings.ollamaUrl}
                    onChange={(e) => update("ollamaUrl", e.target.value)}
                    placeholder="http://localhost:11434"
                    className="input-field"
                  />
                </Label>
                <p className="text-xs text-white/40">
                  推奨: qwen2.5:1.5b（軽量・高速）/ qwen2.5:7b（高精度）
                </p>
              </>
            )}
          </>
        )}
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

export default SettingsPanel;
