import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const pendingOption = pendingModel
    ? MODEL_OPTIONS.find((m) => m.value === pendingModel)
    : null;

  const handleModelChange = useCallback(
    async (value: string) => {
      if (value === settings.whisperModel) return;

      const cleanup = await listen<{ status: string; model?: string; cached?: boolean }>(
        "sidecar-message",
        (event) => {
          if (event.payload.status !== "model_status") return;
          if (event.payload.model !== value) return;
          unlistenRef.current?.();
          unlistenRef.current = null;

          if (event.payload.cached) {
            update("whisperModel", value);
          } else {
            setPendingModel(value);
          }
        }
      );
      unlistenRef.current = cleanup;
      invoke("check_whisper_model", { model: value }).catch(() => {
        cleanup();
        setPendingModel(value);
      });
    },
    [settings.whisperModel, update]
  );

  const confirmDownload = () => {
    if (!pendingModel) return;
    setDownloading(true);
    update("whisperModel", pendingModel);
    setPendingModel(null);
    setTimeout(() => setDownloading(false), 3000);
  };

  const cancelDownload = () => {
    setPendingModel(null);
  };

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
              onChange={(e) => handleModelChange(e.target.value)}
              className="input-field"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
            {downloading && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {t("model.downloading", L)}
              </p>
            )}
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

      {pendingModel && pendingOption && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              {t("model.downloadTitle", L)}
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              {t("model.downloadConfirm", L, {
                name: pendingOption.label,
                size: String(pendingOption.sizeMB),
              })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDownload}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {t("model.cancel", L)}
              </button>
              <button
                onClick={confirmDownload}
                className="btn-primary px-4 py-2 text-sm"
              >
                {t("model.download", L)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
