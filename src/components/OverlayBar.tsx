import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RecordingState, AudioLevelPayload } from "../types";
import { useTauriEvent } from "../hooks/useTauriEvent";

type WrapStyle = "none" | "ja_quote" | "bracket" | "double_quote" | "paren";

const WRAP_LABELS: Record<WrapStyle, string> = {
  none: "",
  ja_quote: "「」",
  bracket: "[]",
  double_quote: '""',
  paren: "()",
};

const WRAP_KEY_MAP: Record<string, WrapStyle> = {
  a: "ja_quote",
  s: "bracket",
  d: "double_quote",
  f: "paren",
};

const OVERLAY_VIDEOS = ["/overlay-1.mp4", "/overlay-2.mp4", "/overlay-3.mp4"];
function pickRandom() {
  return OVERLAY_VIDEOS[Math.floor(Math.random() * OVERLAY_VIDEOS.length)];
}

const WAVE_COLORS: Record<RecordingState, string[]> = {
  idle: ["rgba(120,120,140,0.4)", "rgba(100,100,120,0.3)"],
  listening: ["rgba(94,138,255,0.6)", "rgba(168,85,247,0.4)"],
  transcribing: ["rgba(255,138,94,0.6)", "rgba(236,72,153,0.4)"],
  postprocessing: ["rgba(74,222,128,0.6)", "rgba(34,197,94,0.4)"],
};

const W = 340;
const H = 80;

function OverlayBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<RecordingState>("listening");
  const [streamText, setStreamText] = useState("");
  const [wrap, setWrap] = useState<WrapStyle>("none");
  const audioLevelRef = useRef(0);
  const animFrameRef = useRef(0);
  const [videoSrc, setVideoSrc] = useState(pickRandom);

  useTauriEvent<string>("recording-state", (event) => {
    const next = event.payload as RecordingState;
    setState((prev) => {
      if (next === "listening" && prev !== "listening") setVideoSrc(pickRandom());
      return next;
    });
    if (next === "listening" || next === "idle") {
      setStreamText("");
      setWrap("none");
      invoke("set_wrap_style", { style: "none" }).catch(() => {});
    }
  });
  useTauriEvent<AudioLevelPayload>("audio-level", (event) => {
    audioLevelRef.current = event.payload.level;
  });
  useTauriEvent("postprocessing", () => { setState("postprocessing"); setStreamText(""); });
  useTauriEvent<{ text?: string }>("postprocessing-token", (event) => {
    if (event.payload.text) setStreamText(event.payload.text);
  });

  // Listen for A/S/D/F key taps during recording to set wrap style
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (state !== "listening") return;
      const key = e.key.toLowerCase();
      const mapped = WRAP_KEY_MAP[key];
      if (mapped) {
        e.preventDefault();
        // Toggle: if same key pressed again, clear wrap
        const next = wrap === mapped ? "none" : mapped;
        setWrap(next);
        invoke("set_wrap_style", { style: next }).catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, wrap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    let phase = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const level = audioLevelRef.current;
      const stateColors = WAVE_COLORS[state] || WAVE_COLORS.idle;
      const baseAmplitude = state === "idle" ? 4 : 8;
      const amplitude = baseAmplitude + level * 16;
      const speed = state === "idle" ? 0.015 : 0.03 + level * 0.02;
      phase += speed;

      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.strokeStyle = stateColors[w % stateColors.length];
        ctx.lineWidth = 2.5 - w * 0.5;
        const freq = 0.015 + w * 0.005;
        const phaseOffset = w * 1.2;
        const amp = amplitude * (1 - w * 0.25);

        for (let x = 0; x < W; x++) {
          const envelope = Math.sin((x / W) * Math.PI);
          const y = H / 2
            + Math.sin(x * freq + phase + phaseOffset) * amp * envelope
            + Math.sin(x * freq * 2.5 + phase * 1.5 + phaseOffset) * amp * 0.3 * envelope;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 60 + level * 40);
      gradient.addColorStop(0, stateColors[0].replace("0.6", "0.15"));
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state]);

  const isListening = state === "listening";
  const showStream = state === "postprocessing" && streamText;

  return (
    <div className="overlay-bar">
      <canvas ref={canvasRef} style={{ width: W, height: H, position: "absolute", top: 0, left: 0 }} />

      {isListening && (
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay loop muted playsInline
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.3, pointerEvents: "none", mixBlendMode: "screen",
          }}
        />
      )}

      <span style={{
        position: "relative", zIndex: 1, color: "rgba(255,255,255,0.7)",
        fontSize: showStream ? 11 : 13, fontWeight: 500, letterSpacing: "0.03em",
        textShadow: "0 1px 4px rgba(0,0,0,0.5)", maxWidth: 300,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 20px",
      }}>
        {showStream ? streamText : (
          state === "idle" ? "" :
          state === "listening" ? (wrap !== "none" ? `${WRAP_LABELS[wrap]} Listening...` : "Listening...") :
          state === "transcribing" ? "Transcribing..." :
          "Post-processing..."
        )}
      </span>
    </div>
  );
}

export default OverlayBar;
