import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type RecordingState = "idle" | "listening" | "transcribing" | "postprocessing";

interface AudioLevelPayload {
  status: string;
  level: number;
}

const W = 320;
const H = 72;

function OverlayBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<RecordingState>("listening");
  const [streamText, setStreamText] = useState("");
  const audioLevelRef = useRef(0);
  const animFrameRef = useRef(0);
  const gifKeyRef = useRef(0);

  useEffect(() => {
    const unlisten1 = listen<string>("recording-state", (event) => {
      const next = event.payload as RecordingState;
      setState((prev) => {
        if (next === "listening" && prev !== "listening") {
          gifKeyRef.current += 1;
        }
        return next;
      });
      if (event.payload === "listening" || event.payload === "idle") {
        setStreamText("");
      }
    });
    const unlisten2 = listen<AudioLevelPayload>("audio-level", (event) => {
      audioLevelRef.current = event.payload.level;
    });
    const unlisten3 = listen("postprocessing", () => {
      setState("postprocessing");
      setStreamText("");
    });
    const unlisten4 = listen<{ text?: string }>("postprocessing-token", (event) => {
      if (event.payload.text) {
        setStreamText(event.payload.text);
      }
    });

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      unlisten3.then((f) => f());
      unlisten4.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    let phase = 0;

    const colors: Record<RecordingState, string[]> = {
      idle: ["rgba(120,120,140,0.3)", "rgba(100,100,120,0.2)"],
      listening: ["rgba(94,138,255,0.4)", "rgba(168,85,247,0.25)"],
      transcribing: ["rgba(255,138,94,0.5)", "rgba(236,72,153,0.35)"],
      postprocessing: ["rgba(74,222,128,0.5)", "rgba(34,197,94,0.35)"],
    };

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const level = audioLevelRef.current;
      const stateColors = colors[state] || colors.idle;

      const amplitude = (state === "idle" ? 3 : 5) + level * 12;
      const speed = (state === "idle" ? 0.012 : 0.025) + level * 0.015;
      phase += speed;

      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.strokeStyle = stateColors[w % stateColors.length];
        ctx.lineWidth = 1.8 - w * 0.4;
        const freq = 0.014 + w * 0.004;
        const phaseOffset = w * 1.2;
        const amp = amplitude * (1 - w * 0.25);

        for (let x = 0; x < W; x++) {
          const envelope = Math.sin((x / W) * Math.PI);
          const y = H / 2 +
            Math.sin(x * freq + phase + phaseOffset) * amp * envelope +
            Math.sin(x * freq * 2.5 + phase * 1.5 + phaseOffset) * amp * 0.2 * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state]);

  const isListening = state === "listening";
  const showStream = state === "postprocessing" && streamText;

  const label =
    state === "idle" ? "" :
    state === "listening" ? "Listening..." :
    state === "transcribing" ? "Transcribing..." :
    "Post-processing...";

  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: "50%",
        background: "rgba(8, 8, 16, 0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "8px auto",
        position: "relative",
        overflow: "hidden",
        animation: "fadeIn 150ms ease-out",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H, position: "absolute", top: 0, left: 0, opacity: isListening ? 0.3 : 0.7 }}
      />

      {isListening && (
        <img
          key={gifKeyRef.current}
          src="/listening.gif"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.4,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      )}

      <span
        style={{
          position: "relative",
          zIndex: 1,
          color: "rgba(255,255,255,0.8)",
          fontSize: showStream ? 10 : 13,
          fontWeight: 400,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          letterSpacing: "0.1em",
          textShadow: "0 1px 8px rgba(0,0,0,0.8)",
          maxWidth: W - 60,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {showStream ? streamText : label}
      </span>
    </div>
  );
}

export default OverlayBar;
