import { Activity, Cpu, MemoryStick, Timer } from "lucide-react";
import { useEffect, useState } from "react";

const bytesToMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);

const Stat = ({ icon, label, value, accent = false }) => (
  <div className="rounded-xl border border-white/7 bg-white/3 p-3">
    <div className="mb-2 flex items-center gap-2 text-[8px] uppercase tracking-[0.18em] text-white/28">
      {icon}
      {label}
    </div>
    <div className={`font-mono text-sm ${accent ? "text-emerald-300/85" : "text-white/72"}`}>
      {value}
    </div>
  </div>
);

const SystemMonitor = ({ canvasRef, pointCount }) => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    frameTime: 0,
    jsHeap: null,
    jsHeapLimit: null,
    graphicsMemory: 0,
    renderer: "WebGL renderer",
    history: [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl?.getParameter(gl.RENDERER) || "Unavailable";

    let frameId;
    let frames = 0;
    let sampledAt = performance.now();

    const sample = (now) => {
      frames += 1;
      const elapsed = now - sampledAt;

      if (elapsed >= 750) {
        const fps = Math.round((frames * 1000) / elapsed);
        const frameTime = fps > 0 ? 1000 / fps : 0;
        const heap = performance.memory;
        const pointBufferBytes = pointCount * 3 * Float32Array.BYTES_PER_ELEMENT;
        const framebufferBytes = canvas.width * canvas.height * 4 * 2;

        setMetrics((current) => ({
          fps,
          frameTime,
          jsHeap: heap?.usedJSHeapSize ?? null,
          jsHeapLimit: heap?.jsHeapSizeLimit ?? null,
          graphicsMemory: pointBufferBytes + framebufferBytes,
          renderer,
          history: [...current.history, fps].slice(-28),
        }));

        frames = 0;
        sampledAt = now;
      }

      frameId = requestAnimationFrame(sample);
    };

    frameId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frameId);
  }, [canvasRef, pointCount]);

  const graphPoints = metrics.history
    .map((fps, index) => {
      const x = metrics.history.length > 1 ? (index / (metrics.history.length - 1)) * 240 : 0;
      const y = 42 - Math.min(fps, 60) / 60 * 38;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <aside className="absolute top-[7.75rem] right-8 z-30 w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#080a0b]/88 shadow-[0_22px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/7 px-4 py-3">
        <span className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/48">
          <Activity size={12} className="text-emerald-300/70" /> System monitor
        </span>
        <span className="flex items-center gap-1.5 text-[8px] font-mono uppercase text-emerald-300/55">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
        </span>
      </div>

      <div className="p-3">
        <div className="mb-3 rounded-xl border border-white/7 bg-black/25 p-3">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-[8px] uppercase tracking-[0.18em] text-white/25">Frame rate</span>
            <span className="font-mono text-lg text-emerald-300/90">{metrics.fps} FPS</span>
          </div>
          <svg viewBox="0 0 240 44" className="h-11 w-full overflow-visible" aria-hidden="true">
            <line x1="0" y1="4" x2="240" y2="4" stroke="rgba(255,255,255,.06)" />
            <line x1="0" y1="23" x2="240" y2="23" stroke="rgba(255,255,255,.04)" />
            <line x1="0" y1="42" x2="240" y2="42" stroke="rgba(255,255,255,.06)" />
            <polyline
              points={graphPoints}
              fill="none"
              stroke="rgba(110,231,183,.78)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Timer size={10} />}
            label="Frame time"
            value={`${metrics.frameTime.toFixed(1)} ms`}
          />
          <Stat
            icon={<MemoryStick size={10} />}
            label="JS heap"
            value={metrics.jsHeap ? `${bytesToMB(metrics.jsHeap)} MB` : "Restricted"}
          />
          <Stat
            icon={<Cpu size={10} />}
            label="WebGL est."
            value={`${bytesToMB(metrics.graphicsMemory)} MB`}
          />
          <Stat icon={<Activity size={10} />} label="GPU load" value="Restricted" />
        </div>

        <div className="mt-3 border-t border-white/6 pt-3">
          <p className="truncate text-[9px] text-white/35" title={metrics.renderer}>
            {metrics.renderer}
          </p>
          <div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-white/18">
            <span>{pointCount.toLocaleString()} points</span>
            <span>
              {navigator.deviceMemory ? `~${navigator.deviceMemory} GB device RAM` : "RAM hidden"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SystemMonitor;
