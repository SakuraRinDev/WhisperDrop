import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

function settingsToSidecarConfig(s: Settings) {
  return {
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
  };
}

async function sendConfigToSidecar(s: Settings) {
  await invoke("send_sidecar_config", { config: settingsToSidecarConfig(s) }).catch(() => {});
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

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
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

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

  return { settings, save, update };
}
