import { t, type Locale } from "../../i18n";
import type { Settings } from "../../types";
import { Section } from "../ui/Section";

interface Props {
  settings: Settings;
  locale: Locale;
  onEditVocab: () => void;
}

export function DictionaryTab({ settings, locale: L, onEditVocab }: Props) {
  return (
    <div>
      <Section title={t("section.vocabulary", L)}>
        <p className="text-xs -mt-2 mb-3" style={{ color: "var(--text-faint)" }}>
          {t("vocab.desc", L)}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {settings.vocabularyEntries.length > 0
              ? t("vocab.registered", L, { n: settings.vocabularyEntries.filter((e) => e.word.trim()).length })
              : t("vocab.none", L)}
          </p>
          <button onClick={onEditVocab} className="btn-secondary text-sm">
            {t("vocab.edit", L)}
          </button>
        </div>
        {settings.customVocabulary && (
          <p className="text-xs mt-2 truncate" style={{ color: "var(--text-faint)" }}>
            Prompt: {settings.customVocabulary}
          </p>
        )}
      </Section>
    </div>
  );
}
