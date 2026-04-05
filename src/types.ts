import type { Locale } from "./i18n";

export type Theme = "light" | "dark";
export type RecordingState = "idle" | "listening" | "transcribing" | "postprocessing";

export interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  sample_rate: number;
  default: boolean;
}

export interface OllamaModel {
  name: string;
  description: string;
  size_label: string;
  installed: boolean;
  recommended: boolean;
}

export interface PullEvent {
  status: string;
  model?: string;
  percent?: number;
  pull_status?: string;
  message?: string;
}

export interface VocabEntry {
  word: string;
  reading: string;
}

export interface AudioLevelPayload {
  status: string;
  level: number;
}

export interface HistoryEntry {
  id: number;
  text: string;
  language: string | null;
  timestamp: string;
  duration_ms: number | null;
}

export interface Settings {
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

export const DEFAULT_SETTINGS: Settings = {
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

export const MODEL_OPTIONS = [
  {
    value: "large-v3-turbo",
    label: "large-v3-turbo",
    desc: "Multilingual — best speed/accuracy balance",
    sizeMB: 1500,
  },
  {
    value: "kotoba-v2.0",
    label: "kotoba-v2.0",
    desc: "Japanese-optimized — higher accuracy for Japanese",
    sizeMB: 1500,
  },
];

export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
];
