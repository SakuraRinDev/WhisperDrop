import { useEffect, useState } from "react";

interface HistoryEntry {
  id: number;
  text: string;
  language: string | null;
  timestamp: string;
  duration_ms: number | null;
}

function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      const db = await Database.load("sqlite:whisperdrop.db");
      const result = await db.select<HistoryEntry[]>(
        "SELECT id, text, language, timestamp, duration_ms FROM history ORDER BY id DESC LIMIT 100",
      );
      setEntries(result);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback handled by Tauri
    }
  };

  if (loading) {
    return (
      <div className="text-center text-white/40 py-12">Loading...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center text-white/40 py-12">
        <p className="text-lg">No transcriptions yet</p>
        <p className="text-sm mt-2">
          Press Ctrl+Shift+Space to start recording
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="bg-white/5 rounded-xl p-4 hover:bg-white/8 transition-colors cursor-pointer group"
          onClick={() => copyToClipboard(entry.text)}
        >
          <p className="text-sm text-white/90 leading-relaxed">
            {entry.text}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
            {entry.language && <span>{entry.language}</span>}
            {entry.duration_ms && (
              <span>{(entry.duration_ms / 1000).toFixed(1)}s</span>
            )}
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-white/50">
              Click to copy
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HistoryPanel;
