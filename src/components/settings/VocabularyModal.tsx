import { useState } from "react";
import { t, type Locale } from "../../i18n";
import type { VocabEntry } from "../../types";

interface Props {
  entries: VocabEntry[];
  onClose: (entries: VocabEntry[] | null) => void;
  locale: Locale;
}

export function VocabularyModal({ entries: initialEntries, onClose, locale }: Props) {
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
