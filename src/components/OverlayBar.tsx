import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type RecordingState = "idle" | "listening" | "transcribing" | "postprocessing";

interface AudioLevelPayload {
  status: string;
  level: number;
}

function OverlayBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<RecordingState>("listening");
  const audioLevelRef = useRef(0);
  const animFrameRef = useRef(0);

  useEffect(() => {
    const unlisten1 = listen<string>("recording-state", (event) => {
      setState(event.payload as RecordingState);
    });
    const unlisten2 = listen<AudioLevelPayload>("audio-level", (event) => {
      audioLevelRef.current = event.payload.level;
    });
    const unlisten3 = listen("postprocessing", () => {
      setState("postprocessing");
    });

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      unlisten3.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const W = 400;
    const H = 72;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    let phase = 0;

    const colors: Record<RecordingState, string[]> = {
      idle: ["rgba(120,120,140,0.4)", "rgba(100,100,120,0.3)"],
      listening: ["rgba(94,138,255,0.6)", "rgba(168,85,247,0.4)"],
      transcribing: ["rgba(255,138,94,0.6)", "rgba(236,72,153,0.4)"],
      postprocessing: ["rgba(74,222,128,0.6)", "rgba(34,197,94,0.4)"],
    };

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const level = audioLevelRef.current;
      const stateColors = colors[state] || colors.idle;

      const baseAmplitude = state === "idle" ? 4 : 8;
      const amplitude = baseAmplitude + level * 16;
      const speed = state === "idle" ? 0.015 : 0.03 + level * 0.02;
      phase += speed;

      // Draw multiple wave layers
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        const waveColor = stateColors[w % stateColors.length];
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 2.5 - w * 0.5;

        const freq = 0.015 + w * 0.005;
        const phaseOffset = w * 1.2;
        const amp = amplitude * (1 - w * 0.25);

        for (let x = 0; x < W; x++) {
          // Envelope: fade at edges
          const envelope = Math.sin((x / W) * Math.PI);
          const y =
            H / 2 +
            Math.sin(x * freq + phase + phaseOffset) * amp * envelope +
            Math.sin(x * freq * 2.5 + phase * 1.5 + phaseOffset) *
              amp *
              0.3 *
              envelope;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Center glow
      const gradient = ctx.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        60 + level * 40,
      );
      gradient.addColorStop(0, stateColors[0].replace("0.6", "0.15"));
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state]);

  const statusText: Record<RecordingState, string> = {
    idle: "",
    listening: "Listening...",
    transcribing: "Transcribing...",
    postprocessing: "Post-processing...",
  };

  return (
    <div className="overlay-bar">
      <canvas
        ref={canvasRef}
        style={{ width: 400, height: 72, position: "absolute", top: 0, left: 0 }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.03em",
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      >
        {statusText[state]}
      </span>
    </div>
  );
}

export default OverlayBar;
