import { useCallback, useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import type { HistoryEntry } from "../types";

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:whisperdrop.db");
  }
  return dbPromise;
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<HistoryEntry[]>(
        "SELECT id, text, language, timestamp, duration_ms FROM history ORDER BY id DESC LIMIT 200"
      );
      setEntries(rows);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (text: string, language: string | null, durationMs: number | null) => {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT INTO history (text, language, duration_ms) VALUES ($1, $2, $3)",
          [text, language, durationMs]
        );
        await refresh();
      } catch (e) {
        console.error("Failed to save history:", e);
      }
    },
    [refresh]
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM history WHERE id = $1", [id]);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } catch (e) {
        console.error("Failed to delete history:", e);
      }
    },
    []
  );

  const clearAll = useCallback(async () => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM history");
      setEntries([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  }, []);

  return { entries, loading, refresh, addEntry, deleteEntry, clearAll };
}
