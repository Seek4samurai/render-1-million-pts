import { useEffect, useRef, useState } from "react";
import { identifySong, loadMeshFromBackend } from "./api/API";
import Crosshair from "./Components/Crosshair";
import Preview from "./Components/Preview";

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
    const limit = 3; // Inc this to add more padding around the spiral
    t.x = Math.min(limit, Math.max(-limit, t.x));
    t.y = Math.min(limit, Math.max(-limit, t.y));
  };

  // Since the zoom is float and it triggers even in fractions of zoom level changes
  // This was the fix I thought of...
  const zoomStep = Math.round(currentZoom * 5) / 5; // Changes every 0.2 zoom units
  const gridX = Math.round(coords.x * 10) / 10; // Changes every 0.1 world units
  const gridY = Math.round(coords.y * 10) / 10;

  useEffect(() => {
    // Zoom Gate (Stay quiet if zoomed out)
    if (currentZoom < 1.85) {
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
    const hoverTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, hoverTexture);
    // Fill with a 1x1 transparent pixel
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );

    // Set default parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const updateHoverTexture = (imgSource) => {
      // if (!imgSource) {
      //   console.log("Issue in image or image not found");
      //   return;
      // }

      // Accessing the .current property of the ref
      if (textureCache.current.has(imgSource)) {
        const cachedImg = textureCache.current.get(imgSource);
        gl.bindTexture(gl.TEXTURE_2D, hoverTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          cachedImg,
        );
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
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_S,
              gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_T,
              gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              img,
            );
            currentUrlRef.current = imgSource;
          }
        };
      }
    };

    let animationFrameId;

    // ---- SHADERS ----
    const vs = `
      attribute vec3 aData;
      uniform float uAspect;
      uniform vec2 uOffset;
      uniform float uScale;
      uniform vec2 uHoverPos;
      varying float vIsHover;
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

          // Calculate size
          float size = max(1.0, 3.0 * uScale);

          // --- GROW LOGIC ---
          // Check distance between this point and the hovered coordinate
          float dist = distance(pos, uHoverPos);
          vIsHover = step(dist, 0.0001); // 1.0 if hovered, else 0.0

          if (vIsHover > 0.5) {
              size *= 6.0;
          }
          
          // Dynamic point size based on zoom
          gl_PointSize = size;
      }
    `;

    const fs = `
      precision mediump float;
      varying float vEnergy;
      uniform sampler2D uTexture;
      varying float vIsHover;

      void main() {
          if (vIsHover > 0.5) {
            vec4 tex = texture2D(uTexture, gl_PointCoord);
            gl_FragColor = vec4(tex.rgb, 1.0);
            return;
          }

          vec2 uv = gl_PointCoord - 0.5;

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

    const hoverPosLoc = gl.getUniformLocation(program, "uHoverPos");
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

    // ----- Replaced this logic with auto fetch on zoom and panning -----
    /**
     * Triggers song identification based on the current cursor coordinates - Hard trigger only for click.
     *
     * - Clears any active song tooltip.
     * - Reads the latest (x, y) position from `coordsRef`.
     * - Calls `identifySong` with a fixed radius of 200.
     * - Stores the returned song list in `songsRef` without causing a re-render.
     */
    // const fetchSongsOnClick = async () => {
    //   setHoveredSong(null); // Clear current tooltip
    //   const { x, y } = coordsRef.current;
    //   const data = await identifySong(x, y, 200);
    //   songsRef.current = data;
    // };

    // Triggers song identification based on the current cursor coordinates - Hard trigger only for click.
    // canvas.addEventListener("click", fetchSongsOnClick);
    // -------------------------------------------------------------------

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    const run = async () => {
      const coordsRaw = await loadMeshFromBackend();
      const numPointsToUse = 50000;

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
          console.log(hoveredSongRef.current.data.cover_url);

          updateHoverTexture(hoveredSongRef.current.data.cover_url);

          gl.uniform2f(
            hoverPosLoc,
            hoveredSongRef.current.x,
            hoveredSongRef.current.y,
          );
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

        gl.drawArrays(gl.POINTS, 0, numPointsToUse);
        animationFrameId = requestAnimationFrame(render);
      };

      render();
    };

    run();

    return () => {
      cancelAnimationFrame(animationFrameId);

      // Triggers song identification based on the current cursor coordinates - Hard trigger only for click.
      // canvas.removeEventListener("click", fetchSongsOnClick);

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

      {hoveredSong && (
        <Preview mousePx={mousePx} hoveredSong={hoveredSong}></Preview>
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

