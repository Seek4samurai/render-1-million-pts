import { useEffect, useRef, useState } from "react";
import { identifySong, loadMeshFromBackend } from "./api/API";
import Crosshair from "./Components/Crosshair";
import Preview from "./Components/Preview";
import { MESH_CONFIG } from "./utils/Config";
import { createProgram, initPlaceholderTexture } from "./webgl/GLUtils";
import { fs, vs } from "./webgl/Shaders";

export default function Mesh() {
  const canvasRef = useRef(null);
  const coordsRef = useRef({ x: 0, y: 0 });

  // --- States for maintaining GPS system ---
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(0.5);
  const transform = useRef({
    x: 0.0,
    y: 0.0,
    scale: 0.5,
    targetScale: 0.5,
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
  });

  // --- States for fetching songs ---
  const songsRef = useRef([]);
  const hoveredSongRef = useRef(null);
  const [hoveredSong, setHoveredSong] = useState(null);
  const [mousePx, setMousePx] = useState({ x: 0, y: 0 });

  // --- Ref for show image on hover ---
  const currentUrlRef = useRef(null);

  // ----- World controls -----
  const clampPan = (t) => {
    t.x = Math.min(MESH_CONFIG.LIMIT, Math.max(-MESH_CONFIG.LIMIT, t.x));
    t.y = Math.min(MESH_CONFIG.LIMIT, Math.max(-MESH_CONFIG.LIMIT, t.y));
  };

  // Since the zoom is float and it triggers even in fractions of zoom level changes
  // This was the fix I thought of...
  const zoomStep = Math.round(currentZoom * 5) / 5; // Changes every 0.2 zoom units
  const gridX = Math.round(coords.x * 10) / 10; // Changes every 0.1 world units
  const gridY = Math.round(coords.y * 10) / 10;

  useEffect(() => {
    // Zoom Gate (Stay quiet if zoomed out)
    if (currentZoom < MESH_CONFIG.ZOOM_THRESHOLD) {
      if (songsRef.current.length > 0) {
        songsRef.current = [];
      }
      return;
    }

    // Debounce Timer
    const delay = 150; // Reduced for snappier feel
    const timer = setTimeout(async () => {
      const { x, y } = coordsRef.current;
      try {
        const data = await identifySong(x, y, 800);
        songsRef.current = data;
      } catch (err) {
        console.error("Auto-fetch failed:", err);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentZoom, zoomStep, gridX, gridY]);

  // ----------------------------------------
  // ------------ Main UseEffect ------------
  const textureCache = useRef(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    // Create the texture object once
    const hoverTexture = initPlaceholderTexture(gl);

    const updateHoverTexture = (imgSource) => {
      // Accessing the .current property of the ref
      if (textureCache.current.has(imgSource)) {
        const cachedImg = textureCache.current.get(imgSource);

        gl.bindTexture(gl.TEXTURE_2D, hoverTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cachedImg);

        currentUrlRef.current = imgSource;
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgSource;
        img.onload = () => {
          // Set into .current
          textureCache.current.set(imgSource, img);

          if (hoveredSongRef.current?.cover_url === imgSource) {
            gl.bindTexture(gl.TEXTURE_2D, hoverTexture);

            // Mandatory parameters for Non-Power-of-Two images
            // Prettier is trolling here... Needs to be fixed...
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

            currentUrlRef.current = imgSource;
          }
        };
      }
    };

    // Custom function to create a program instance
    const program = createProgram(gl, vs, fs);

    const hoverPosLoc = gl.getUniformLocation(program, "uHoverPos");
    const aspectLoc = gl.getUniformLocation(program, "uAspect");
    const offsetLoc = gl.getUniformLocation(program, "uOffset");
    const scaleLoc = gl.getUniformLocation(program, "uScale");
    const dataLoc = gl.getAttribLocation(program, "aData");

    // --- INTERACTION EVENTS ---
    const handleWheel = (e) => {
      e.preventDefault();
      transform.current.targetScale *= Math.exp(-e.deltaY * MESH_CONFIG.ZOOM_SPEED);
      // Below is the min & max zoom levels (max = 50, min = 0.25)
      transform.current.targetScale = Math.min(50, Math.max(0.25, transform.current.targetScale));
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
        // --- TODO ----
        // Make this value dynamic according to the zoom level
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
          if (!hoveredSongRef.current || hoveredSongRef.current.id !== found.id) {
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

      const dx = e.clientX - transform.current.lastMouse.x;
      const dy = e.clientY - transform.current.lastMouse.y;

      // Adjust pan sensitivity based on scale
      transform.current.x += ((dx / canvas.clientWidth) * 1.0) / transform.current.scale;
      transform.current.y -= ((dy / canvas.clientHeight) * 1.0) / transform.current.scale;
      transform.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      transform.current.isDragging = false;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    let animationFrameId;

    const run = async () => {
      const coordsRaw = await loadMeshFromBackend();

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

        if (hoveredSongRef.current) {
          // TRIGGER THE TEXTURE UPDATE
          updateHoverTexture(hoveredSongRef.current.data.cover_url);
          gl.uniform2f(hoverPosLoc, hoveredSongRef.current.x, hoveredSongRef.current.y);
        } else {
          // Move it far away so no points grow
          gl.uniform2f(hoverPosLoc, -999.0, -999.0);
        }

        // Now these locations are guaranteed to be from the "associated program"
        gl.uniform1f(aspectLoc, canvas.width / canvas.height);
        gl.uniform2f(offsetLoc, transform.current.x, transform.current.y);
        gl.uniform1f(scaleLoc, transform.current.scale);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, hoverTexture);
        gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);

        gl.drawArrays(gl.POINTS, 0, MESH_CONFIG.S_NUM_POINTS);
        animationFrameId = requestAnimationFrame(render);
      };
      render();
    };
    run();

    return () => {
      cancelAnimationFrame(animationFrameId);
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
        className="w-[95vw] h-[95vh] rounded-2xl cursor-grab active:cursor-grabbing touch-none border border-white/5"
      />

      <Crosshair></Crosshair>

      {/* {hoveredSong && (
        <Tooltip mousePx={mousePx} hoveredSong={hoveredSong}></Tooltip>
      )} */}

      {hoveredSong && <Preview mousePx={mousePx} hoveredSong={hoveredSong}></Preview>}

      {/* Bottom-Left Coordinate HUD */}
      <div className="absolute bottom-10 left-15 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/5 text-white/80 text-xs font-mono shadow-lg">
        <span className="text-blue-400">POS:</span> {coords.x}, {coords.y}
        <span className="mx-2 text-white/20">|</span>
        <span className="text-emerald-400">ZOOM:</span> {currentZoom.toFixed(2)}x
      </div>
    </div>
  );
}
