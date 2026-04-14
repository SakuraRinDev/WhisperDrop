import { useState } from "react";
import { t, type Locale } from "../../i18n";
import type { HistoryEntry } from "../../types";

interface Props {
  entries: HistoryEntry[];
  loading: boolean;
  locale: Locale;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onClearAll: () => void;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts + "Z");
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function CopyButton({ text, locale, onCopy }: { text: string; locale: Locale; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded transition-all ${copied ? "" : "opacity-0 group-hover:opacity-100"}`}
      style={{
        color: copied ? "var(--accent-success)" : "var(--text-faint)",
      }}
      title={t("history.copy", locale)}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export function HistoryTab({ entries, loading, locale: L, onCopy, onDelete, onClearAll }: Props) {
  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
        Loading...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
        <p className="text-lg mb-1">{t("history.empty", L)}</p>
        <p className="text-sm">{t("history.emptyDesc", L)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("history.count", L, { n: entries.length })}
        </span>
        <button
          onClick={onClearAll}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border-input)" }}
        >
          {t("history.clearAll", L)}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="card group flex items-start gap-3"
            style={{ padding: "10px 14px" }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-sm leading-relaxed break-words"
                style={{ color: "var(--text-primary)" }}
              >
                {entry.text}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
                {entry.duration_ms != null && (
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {formatDuration(entry.duration_ms)}
                  </span>
                )}
                {entry.language && (
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {entry.language}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 items-center">
              <CopyButton text={entry.text} locale={L} onCopy={onCopy} />
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-faint)" }}
                title={t("history.delete", L)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
