import { useEffect, useRef, useState } from "react";
import { identifySong, loadMeshFromBackend } from "./api/API";
import Crosshair from "./Components/Crosshair";
import Tooltip from "./Components/Tooltip";

export default function Mesh() {
  const canvasRef = useRef(null);
  const coordsRef = useRef({ x: 0, y: 0 });

  // States for maintaining GPS system
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(0.5);

  // States for fetching songs
  const songsRef = useRef([]);
  const hoveredSongRef = useRef(null);
  const [hoveredSong, setHoveredSong] = useState(null);
  const [mousePx, setMousePx] = useState({ x: 0, y: 0 });

  function clampPan(t) {
    const limit = 2;
    t.x = Math.min(limit, Math.max(-limit, t.x));
    t.y = Math.min(limit, Math.max(-limit, t.y));
  }

  const transform = useRef({
    x: 0.0,
    y: 0.0,
    scale: 0.5,
    targetScale: 0.5,
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    let animationFrameId;

    // ---- SHADERS ----
    const vs = `
      attribute vec3 aData;
      uniform float uAspect;
      uniform vec2 uOffset;
      uniform float uScale;
      varying float vEnergy;

      void main() {
          // The baked data is already x, y, energy
          vec2 pos = aData.xy; 
          
          // If baked energy is raw (0-500), keep this. 
          // If baked energy is normalized (0-1), remove "/500.0".
          vEnergy = aData.z; 

          float baseScale = 10.0;

          // Apply Pan & Zoom
          vec2 transformedPos = (pos + uOffset) * (uScale * baseScale);
          
          // Correct for aspect ratio
          transformedPos.x /= uAspect;

          gl_Position = vec4(transformedPos, 0.0, 1.0);
          
          // Dynamic point size based on zoom
          gl_PointSize = max(1.0, 3.0 * uScale);
      }
    `;

    const fs = `
      precision mediump float;
      varying float vEnergy;

      void main() {
          float h = vEnergy;
          float s = 1.0;
          float l = 0.5;
          float c = (1.0 - abs(2.0 * l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
          float m = l - c / 2.0;
          vec3 rgb;

          if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
          else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
          else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
          else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
          else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
          else rgb = vec3(c, 0.0, x);

          gl_FragColor = vec4(rgb + m, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Shader Error:", gl.getShaderInfoLog(s));
      }
      return s;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const aspectLoc = gl.getUniformLocation(program, "uAspect");
    const offsetLoc = gl.getUniformLocation(program, "uOffset");
    const scaleLoc = gl.getUniformLocation(program, "uScale");
    const dataLoc = gl.getAttribLocation(program, "aData");

    // --- INTERACTION EVENTS ---
    const handleWheel = (e) => {
      e.preventDefault();
      // const zoomSpeed = 0.1;
      const zoomSpeed = 0.005; // smaller = smoother
      transform.current.targetScale *= Math.exp(-e.deltaY * zoomSpeed);
      transform.current.targetScale = Math.min(
        50,
        Math.max(0.25, transform.current.targetScale),
      );
    };

    const handleMouseDown = (e) => {
      transform.current.isDragging = true;
      transform.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!transform.current.isDragging) {
        const rect = canvas.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        const my = -(((e.clientY - rect.top) / canvas.clientHeight) * 2 - 1);

        const aspect = canvas.width / canvas.height;
        const t = transform.current;

        const worldX = (mx * aspect) / (t.scale * 10.0) - t.x;
        const worldY = my / (t.scale * 10.0) - t.y;

        coordsRef.current = { x: worldX, y: worldY };
        setCoords({ x: worldX.toFixed(3), y: worldY.toFixed(3) });

        // --- TESTING NEW HOVER LOGIC ---
        let found = null;
        // The "hitbox" size. Adjust 0.005 to make it easier or harder to hover.
        const threshold = 0.005 / t.scale;

        songsRef.current.forEach((song) => {
          const dx = worldX - song.x;
          const dy = worldY - song.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < threshold) {
            found = song;
          }
        });

        setMousePx({ x: e.clientX, y: e.clientY });

        if (found) {
          // Only update if it's a DIFFERENT song than what we are already showing
          if (
            !hoveredSongRef.current ||
            hoveredSongRef.current.id !== found.id
          ) {
            hoveredSongRef.current = found;
            setHoveredSong(found);
          }
        } else {
          // If we found nothing, and a tooltip is currently showing, HIDE IT
          if (hoveredSongRef.current !== null) {
            hoveredSongRef.current = null;
            setHoveredSong(null);
          }
        }
        return;
      }

      if (!transform.current.isDragging) return;

      const dx = e.clientX - transform.current.lastMouse.x;
      const dy = e.clientY - transform.current.lastMouse.y;

      // Adjust pan sensitivity based on scale
      transform.current.x +=
        ((dx / canvas.clientWidth) * 1.0) / transform.current.scale;
      transform.current.y -=
        ((dy / canvas.clientHeight) * 1.0) / transform.current.scale;

      transform.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      transform.current.isDragging = false;
    };

    // ----- Some fixes still remaining br -----
    const onClick = async () => {
      setHoveredSong(null); // Clear current tooltip
      const { x, y } = coordsRef.current;
      const data = await identifySong(x, y, 200);
      songsRef.current = data;
    };
    // ----- YE KRNA HAI BAADME -----

    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    const run = async () => {
      const coordsRaw = await loadMeshFromBackend();
      const numPointsToUse = 500000;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, coordsRaw, gl.STATIC_DRAW);

      gl.enableVertexAttribArray(dataLoc);
      gl.vertexAttribPointer(dataLoc, 3, gl.FLOAT, false, 0, 0);

      const render = () => {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== canvas.clientWidth * dpr) {
          canvas.width = canvas.clientWidth * dpr;
          canvas.height = canvas.clientHeight * dpr;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // smooth zoom
        const t = transform.current;
        t.scale += (t.targetScale - t.scale) * 0.05;
        clampPan(transform.current);

        if (Math.abs(t.scale - currentZoom) > 0.01) {
          setCurrentZoom(t.scale);
        }

        gl.useProgram(program);

        // Now these locations are guaranteed to be from the "associated program"
        gl.uniform1f(aspectLoc, canvas.width / canvas.height);
        gl.uniform2f(offsetLoc, transform.current.x, transform.current.y);
        gl.uniform1f(scaleLoc, transform.current.scale);

        gl.drawArrays(gl.POINTS, 0, numPointsToUse);
        animationFrameId = requestAnimationFrame(render);
      };

      render();
    };

    run();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-neutral-950 flex items-center justify-center overflow-hidden font-sans">
      {/* The WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-[95vw] h-[95vh] rounded-2xl cursor-move touch-none border border-white/5"
      />

      <Crosshair></Crosshair>

      {hoveredSong && (
        <Tooltip mousePx={mousePx} hoveredSong={hoveredSong}></Tooltip>
      )}

      {/* Bottom-Left Coordinate HUD */}
      <div className="absolute bottom-10 left-15 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/5 text-white/80 text-xs font-mono shadow-lg">
        <span className="text-blue-400">POS:</span> {coords.x}, {coords.y}
        <span className="mx-2 text-white/20">|</span>
        <span className="text-emerald-400">ZOOM:</span> {currentZoom.toFixed(2)}
        x
      </div>
    </div>
  );
}

