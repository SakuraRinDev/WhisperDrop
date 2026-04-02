import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import OverlayBar from "./components/OverlayBar";
import SettingsPanel from "./components/SettingsPanel";
import HistoryPanel from "./components/HistoryPanel";

type Tab = "settings" | "history";

function App() {
  const [isOverlay, setIsOverlay] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  useEffect(() => {
    getCurrentWindow()
      .label.then
      ? void 0
      : void 0;
    const label = getCurrentWindow().label;
    setIsOverlay(label === "overlay");
  }, []);

  if (isOverlay) {
    return (
      <div className="overlay-root">
        <OverlayBar />
      </div>
    );
  }

  return (
    <div className="settings-container">
      <header className="settings-header sticky top-0 z-10 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">WhisperDrop</h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "settings"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      <main className="p-6">
        {activeTab === "settings" ? <SettingsPanel /> : <HistoryPanel />}
      </main>
    </div>
  );
}

export default App;
