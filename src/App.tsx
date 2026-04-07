import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import OverlayBar from "./components/OverlayBar";
import SettingsPanel from "./components/SettingsPanel";

function App() {
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    const label = getCurrentWindow().label;
    const overlay = label === "overlay";
    setIsOverlay(overlay);
    if (overlay) {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
  }, []);

  if (isOverlay) {
    return (
      <div className="overlay-root">
        <OverlayBar />
      </div>
    );
  }

  return (
    <div className="settings-container flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 px-8 pt-8 pb-0">
        <div className="max-w-4xl mx-auto w-full">
          <div className="overflow-hidden" style={{ borderRadius: 6 }}>
            <img
              src="/header-banner.png"
              alt=""
              style={{ width: "100%", height: "auto", display: "block", marginTop: "-8%" }}
            />
          </div>
          <h1
            className="font-display text-2xl font-light tracking-tight mt-4 mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            WhisperDrop
          </h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden px-8 pb-8 scrollbar-gutter-stable">
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <SettingsPanel />
        </div>
      </main>
    </div>
  );
}

export default App;
