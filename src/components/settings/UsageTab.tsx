import { t, type Locale } from "../../i18n";
import { Section } from "../ui/Section";

interface Props {
  locale: Locale;
}

const hotkeys = [
  { key: "Ctrl + Shift + Space", i18n: "usage.hotkey.record" as const },
  { key: "Ctrl + Shift + Space ×2", i18n: "usage.hotkey.lock" as const },
  { key: "Escape", i18n: "usage.hotkey.cancel" as const },
];

const flow = [
  "usage.flow.1" as const,
  "usage.flow.2" as const,
  "usage.flow.3" as const,
  "usage.flow.4" as const,
];

const tips = [
  "usage.tip.escape" as const,
  "usage.tip.focus" as const,
];

export function UsageTab({ locale: L }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title={t("usage.hotkeys", L)}>
        <div className="space-y-3">
          {hotkeys.map(({ key, i18n }) => (
            <div key={key} className="flex items-start gap-3">
              <kbd
                className="shrink-0 px-2 py-1 rounded text-xs font-mono"
                style={{
                  backgroundColor: "var(--bg-badge)",
                  border: "1px solid var(--border-input)",
                  color: "var(--text-primary)",
                }}
              >
                {key}
              </kbd>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t(i18n, L)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("usage.flow", L)}>
        <ol className="space-y-2 list-none pl-0">
          {flow.map((i18n, i) => (
            <li key={i18n} className="flex items-start gap-3 text-sm">
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: "var(--bg-badge)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-input)",
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>{t(i18n, L)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("usage.tips", L)} wide>
        <ul className="space-y-2">
          {tips.map((i18n) => (
            <li key={i18n} className="flex items-start gap-2 text-sm">
              <span style={{ color: "var(--text-muted)" }}>•</span>
              <span style={{ color: "var(--text-secondary)" }}>{t(i18n, L)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
