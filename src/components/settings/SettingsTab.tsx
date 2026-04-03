import { invoke } from "@tauri-apps/api/core";
import { t, type Locale } from "../../i18n";
import type { Settings, AudioDevice } from "../../types";
import { MODEL_OPTIONS, LANGUAGE_OPTIONS } from "../../types";
import { Section } from "../ui/Section";
import { Label } from "../ui/Label";

interface Props {
  settings: Settings;
  devices: AudioDevice[];
  locale: Locale;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export function SettingsTab({ settings, devices, locale: L, update }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
  );
}
