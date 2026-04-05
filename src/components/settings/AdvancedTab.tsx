import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { t, type Locale } from "../../i18n";
import type { Settings, OllamaModel } from "../../types";
import { Section } from "../ui/Section";
import { Label } from "../ui/Label";

interface Props {
  settings: Settings;
  ollamaModels: OllamaModel[];
  locale: Locale;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  save: (s: Settings) => void;
}

export function AdvancedTab({ settings, ollamaModels, locale: L, update, save }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <button
            onClick={() => open("https://github.com/SakuraRinDev/WhisperDrop#llm-%E5%BE%8C%E5%87%A6%E7%90%86%E3%81%AE%E6%9C%89%E5%8A%B9%E5%8C%96%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6")}
            className="text-xs mt-1 hover:underline cursor-pointer"
            style={{ color: "var(--text-link, #3b82f6)" }}
          >
            {t("llm.helpLink", L)} →
          </button>
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
                  <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                    ollama.com/download
                  </a>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>→ {t("afterInstall", L)}</span>
                  <button onClick={() => invoke("list_ollama_models").catch(() => {})} className="btn-secondary ml-auto text-xs !px-2 !py-1">
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
                      save({ ...settings, llmProvider: "ollama", ollamaModel: val.slice(7) });
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
                <button onClick={() => invoke("list_ollama_models").catch(() => {})} className="btn-secondary !px-3 !py-2 text-sm" title="Refresh">
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
          <input type="password" value={settings.claudeApiKey} onChange={(e) => update("claudeApiKey", e.target.value)} placeholder="sk-ant-..." className="input-field" />
        </Label>
        <Label text="OpenAI API Key">
          <input type="password" value={settings.openaiApiKey} onChange={(e) => update("openaiApiKey", e.target.value)} placeholder="sk-..." className="input-field" />
        </Label>
      </Section>

      <Section title="VAD / Silence">
        <Label text={`VAD Threshold: ${settings.vadThreshold}`}>
          <input type="range" min="0.1" max="0.9" step="0.1" value={settings.vadThreshold} onChange={(e) => update("vadThreshold", parseFloat(e.target.value))} className="w-full" />
        </Label>
        <Label text={`Silence Duration: ${settings.silenceDuration}s`}>
          <input type="range" min="0.5" max="3.0" step="0.25" value={settings.silenceDuration} onChange={(e) => update("silenceDuration", parseFloat(e.target.value))} className="w-full" />
        </Label>
      </Section>
    </div>
  );
}
