use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: Option<i64>,
    pub text: String,
    pub language: Option<String>,
    pub timestamp: String,
    pub duration_ms: Option<i64>,
}

pub const CREATE_TABLE_SQL: &str = "
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    language TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    duration_ms INTEGER
);
";

pub const INSERT_SQL: &str = "
INSERT INTO history (text, language, duration_ms) VALUES ($1, $2, $3)
";

pub const SELECT_RECENT_SQL: &str = "
SELECT id, text, language, timestamp, duration_ms FROM history ORDER BY id DESC LIMIT 100
";

pub const CLEANUP_SQL: &str = "
DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 100)
";
