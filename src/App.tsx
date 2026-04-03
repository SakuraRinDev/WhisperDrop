import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import OverlayBar from "./components/OverlayBar";
import SettingsPanel from "./components/SettingsPanel";

function App() {
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
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
      <header className="settings-header sticky top-0 z-10 px-8 py-5">
        <h1 className="font-display text-3xl font-light tracking-tight" style={{ color: "var(--text-primary)" }}>
          WhisperDrop
        </h1>
      </header>

      <main className="p-8">
        <SettingsPanel />
      </main>
    </div>
  );
}

export default App;
