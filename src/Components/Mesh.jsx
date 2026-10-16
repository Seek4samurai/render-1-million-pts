import * as Arrow from "apache-arrow";
import KDBush from "kdbush";
import { Gauge, Info, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useCanvasEvents from "../hooks/useCanvasEvents";
import useGPS from "../hooks/useGPS";
import { MESH_CONFIG } from "../utils/Config";
import { createProgram, initPlaceholderTexture } from "../webgl/GLUtils";
import { fs, vs } from "../webgl/Shaders";
import BorderMagnifier from "./BorderMagnifier";
import Crosshair from "./Crosshair";
import Preview from "./Preview";
import Song from "./Song";
import SongSearch from "./SongSearch";
import SystemMonitor from "./SystemMonitor";

export default function Mesh(props) {
  const canvasRef = useRef(null);
  const coordsRef = useRef({ x: 0, y: 0 }); // For GPS
  const meshCoordsRef = useRef(null); // For Coordinates

  /**
   * --- New approach to bring kd-tree to client side ---
   *
   * Here multiple changes are made:
   * Since moving kd-tree to client also requires moving datasets to client but the files were too big.
   * We had to make multiple shards for it to fit the valid size.
   *
   */

  const metadataRef = useRef(null);
  const spatialIndexRef = useRef(null);
  const [dataReady, setDataReady] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [monitorEnabled, setMonitorEnabled] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const pointsPerShard = 111112;
      const numParts = Math.ceil(MESH_CONFIG[props.size] / pointsPerShard);
      const indices = Array.from({ length: numParts }, (_, i) => i);

      try {
        const fetchAsBuffer = async (url) => {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          const buf = await r.arrayBuffer();
          // Check if buffer is suspiciously small (like an error message)
          if (buf.byteLength < 100) throw new Error(`File ${url} is too small/corrupt`);
          return buf;
        };

        // Fetching Coords and Arrow
        const coordBuffers = await Promise.all(
          indices.map((i) => fetchAsBuffer(`/dataset/xl/shards/xl_coords_part${i}.bin`))
        );
        const arrowBuffers = await Promise.all(
          indices.map((i) => fetchAsBuffer(`/dataset/xl/shards/xl_metadata_part${i}.arrow`))
        );

        // --- Merging Coordinates ---
        const totalFloats = coordBuffers.reduce((sum, b) => sum + b.byteLength / 4, 0);
        const combinedCoords = new Float32Array(totalFloats);

        let floatOffset = 0;
        for (const buf of coordBuffers) {
          const view = new Float32Array(buf);
          combinedCoords.set(view, floatOffset);
          floatOffset += view.length;
        }
        meshCoordsRef.current = combinedCoords;

        // --- Merging the Arrow Tables ---
        const tables = arrowBuffers
          .map((buf) => {
            return Arrow.tableFromIPC(new Uint8Array(buf));
          })
          .filter((t) => t !== null); // Remove empty shards

        const allBatches = tables.flatMap((t) => t.batches);
        // It is vital that the schema matches across all parts
        metadataRef.current = new Arrow.Table(tables[0].schema, allBatches);

        // --- Building Spatial Index ---
        const numPoints = combinedCoords.length / 3;
        const index = new KDBush(numPoints);
        for (let i = 0; i < combinedCoords.length; i += 3) {
          index.add(combinedCoords[i], combinedCoords[i + 1]);
        }
        index.finish();
        spatialIndexRef.current = index;
        setDataReady(true);

        // ---------------------------------------
        props.setLoading(false);
        startWebGL(); // STARTING POINT OF WebGL
        // ---------------------------------------
      } catch (err) {
        console.error("Critical Load Error:", err.message);
      }
    };
    loadData();
  }, []);

  // --- States for maintaining GPS system ---
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(0.5);
  const transform = useRef({
    x: 0.0,
    y: 0.0,
    scale: 0.5,
    targetScale: 0.5,
    targetX: 0.0, // Initial target same as start
    targetY: 0.0,
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
  });

  // --- States for fetching songs ---
  const songsRef = useRef([]);
  const hoveredSongRef = useRef(null);
  const [hoveredSong, setHoveredSong] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [mousePx, setMousePx] = useState({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const interactionLockedRef = useRef(false);
  const transitionTokenRef = useRef(0);
  const transitionFrameRef = useRef(null);

  useEffect(
    () => () => {
      transitionTokenRef.current += 1;
      cancelAnimationFrame(transitionFrameRef.current);
    },
    []
  );

  const animateCamera = (destination, duration, token) =>
    new Promise((resolve) => {
      const camera = transform.current;
      const origin = { x: camera.x, y: camera.y, scale: camera.scale };
      const startedAt = performance.now();

      const step = (now) => {
        if (transitionTokenRef.current !== token) {
          resolve(false);
          return;
        }

        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        camera.x = origin.x + (destination.x - origin.x) * eased;
        camera.y = origin.y + (destination.y - origin.y) * eased;
        camera.scale = origin.scale + (destination.scale - origin.scale) * eased;
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        camera.targetScale = camera.scale;

        if (progress < 1) transitionFrameRef.current = requestAnimationFrame(step);
        else resolve(true);
      };

      transitionFrameRef.current = requestAnimationFrame(step);
    });

  const focusSearchResult = async (id) => {
    if (!metadataRef.current || !meshCoordsRef.current || id >= MESH_CONFIG[props.size]) return;

    const arrayIndex = id * 3;
    const song = {
      id,
      x: meshCoordsRef.current[arrayIndex],
      y: meshCoordsRef.current[arrayIndex + 1],
      data: metadataRef.current.get(id).toJSON(),
    };

    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;
    interactionLockedRef.current = true;
    transform.current.isDragging = false;
    hoveredSongRef.current = null;
    setHoveredSong(null);
    setSelectedSong(null);
    setIsTransitioning(true);

    const overviewScale = Math.max(
      MESH_CONFIG.MAX_ZOOM_OUT,
      Math.min(0.18, transform.current.scale * 0.28)
    );
    const pause = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

    try {
      // 1. Pull out to a map-wide view.
      if (
        !(await animateCamera(
          { x: transform.current.x, y: transform.current.y, scale: overviewScale },
          720,
          token
        ))
      ) return;

      // 2. Travel across the map while still zoomed out.
      if (!(await animateCamera({ x: -song.x, y: -song.y, scale: overviewScale }, 1050, token))) {
        return;
      }

      // 3. Three distinct cinematic zoom stages into the selected point.
      for (const stage of [
        { scale: 0.52, duration: 480 },
        { scale: 1.08, duration: 560 },
        { scale: 2.2, duration: 720 },
      ]) {
        await pause(90);
        if (!(await animateCamera({ x: -song.x, y: -song.y, ...stage }, stage.duration, token))) {
          return;
        }
      }

      if (transitionTokenRef.current === token) setSelectedSong(song);
    } finally {
      if (transitionTokenRef.current === token) {
        interactionLockedRef.current = false;
        setIsTransitioning(false);
      }
    }
  };

  // --- Ref for show image on hover ---
  const currentUrlRef = useRef(null);

  // ----------------------------------------------
  // ----- GPS (coordinates system) handler -------
  const { updateTransform } = useGPS(currentZoom, setCurrentZoom, props.size);
  // ----------------------------------------------

  // ---------------------------------------------
  // --- Auto fetch songs system with debounce ---
  // -- Legacy API for fetching songs from API ---
  // useAutoFetchSongs(currentZoom, coordsRef, songsRef);
  // ---------------------------------------------

  // ----------------------------------------------------
  // ----- Mouse/canvas Interactions in this hook -------
  useCanvasEvents(
    spatialIndexRef,
    meshCoordsRef,
    metadataRef,
    currentZoom,
    coordsRef,
    canvasRef,
    songsRef,
    transform,
    hoveredSongRef,
    setSelectedSong,
    setCoords,
    setHoveredSong,
    setMousePx,
    props.size,
    interactionLockedRef
  );

  // ------------ Main UseEffect / Function ------------
  // Previously this was useEffect but now its a function
  // So we call it after the mesh coords loading is done
  const textureCache = useRef(new Map());

  const startWebGL = () => {
    const canvas = canvasRef.current;
    // The border magnifier samples completed frames from this canvas.
    // WebGL may discard its back buffer after compositing unless it is preserved.
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
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

    let animationFrameId;

    const run = async () => {
      // ----- POSITION BUFFER -----
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, meshCoordsRef.current, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(dataLoc);
      gl.vertexAttribPointer(dataLoc, 3, gl.FLOAT, false, 0, 0);

      const render = () => {
        // handle smooth zoom
        updateTransform(transform);

        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== canvas.clientWidth * dpr) {
          canvas.width = canvas.clientWidth * dpr;
          canvas.height = canvas.clientHeight * dpr;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        gl.clearColor(0, 0, 0, 1.0); // Background color - Black
        gl.clear(gl.COLOR_BUFFER_BIT);
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

        gl.drawArrays(gl.POINTS, 0, MESH_CONFIG[props.size]);
        animationFrameId = requestAnimationFrame(render);
      };
      render();
    };
    run();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  };

  return (
    <>
      <div className="relative w-screen h-screen bg-neutral-950 flex items-center justify-center overflow-hidden font-sans">
        <BorderMagnifier sourceCanvasRef={canvasRef} />

        {dataReady && (
          <SongSearch
            maxIndex={MESH_CONFIG[props.size]}
            onSelect={focusSearchResult}
            disabled={isTransitioning}
            visible={searchEnabled}
          />
        )}

        <div className="absolute top-5 right-8 z-40 flex flex-col items-end gap-2">
          {[
            {
              label: "Search",
              icon: <Search size={13} />,
              enabled: searchEnabled,
              toggle: () => setSearchEnabled((enabled) => !enabled),
            },
            {
              label: "Monitor",
              icon: <Gauge size={13} />,
              enabled: monitorEnabled,
              toggle: () => setMonitorEnabled((enabled) => !enabled),
            },
          ].map((control) => (
            <button
              type="button"
              role="switch"
              aria-checked={control.enabled}
              onClick={control.toggle}
              key={control.label}
              className="group flex h-10 items-center gap-3 rounded-full border border-white/25 bg-neutral-900/92 px-3 text-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all hover:border-cyan-100/35 hover:bg-neutral-800/95 hover:text-white"
            >
              {control.icon}
              <span className="text-[9px] font-medium uppercase tracking-[0.18em]">
                {control.label}
              </span>
              <span
                className={`relative h-5 w-9 rounded-full border transition-colors ${
                  control.enabled
                    ? "border-cyan-200/25 bg-cyan-300/16"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all duration-200 ${
                    control.enabled
                      ? "left-[18px] bg-cyan-100 shadow-[0_0_10px_rgba(165,243,252,0.45)]"
                      : "left-0.5 bg-white/35"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>

        {monitorEnabled && (
          <SystemMonitor canvasRef={canvasRef} pointCount={MESH_CONFIG[props.size]} />
        )}

        {isTransitioning && (
          <div className="absolute inset-0 z-30 cursor-wait" aria-label="Travelling to song" />
        )}

        {/* The WebGL Canvas */}
        <canvas
          ref={canvasRef}
          className={`relative z-10 w-[95vw] h-[95vh] rounded-2xl touch-none ${
            isTransitioning ? "cursor-wait" : "cursor-grab active:cursor-grabbing"
          }`}
        />

        <Song selectedSong={selectedSong} onClear={() => setSelectedSong(null)} />

        <Crosshair></Crosshair>

        {hoveredSong && <Preview mousePx={mousePx} hoveredSong={hoveredSong}></Preview>}

        {/* Bottom-Left Coordinate HUD */}
        <div className="absolute z-20 bottom-10 left-15 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/5 text-white/80 text-xs font-mono shadow-lg">
          <span className="text-blue-400">POS:</span> {coords.x}, {coords.y}
          <span className="mx-2 text-white/20">|</span>
          <span className="text-emerald-400">ZOOM:</span> {currentZoom.toFixed(2)}x
        </div>

        <div className="group absolute bottom-10 right-10 z-20">
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 bottom-full mb-2.5 whitespace-nowrap rounded-lg border border-white/8 bg-black/80 px-3 py-2 text-[10px] text-white/55 opacity-0 shadow-xl backdrop-blur-md transition-all duration-200 after:absolute after:top-full after:right-0 after:h-3 after:w-full after:content-[''] group-hover:pointer-events-auto group-hover:-translate-y-0.5 group-hover:opacity-100"
          >
            <span className="block italic">This is not a vibe coded app</span>
            <a
              href="https://github.com/Seek4samurai/render-1-million-pts/blob/main/public/document/render_1m_points_document.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-cyan-200/65 underline decoration-cyan-200/20 underline-offset-2 transition-colors hover:text-cyan-100"
            >
              How it was made
            </a>
          </div>
          <button
            type="button"
            aria-label="About this application"
            className="flex h-9 w-9 cursor-help items-center justify-center rounded-full border border-white/25 bg-neutral-900/92 text-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-all hover:border-cyan-100/40 hover:bg-neutral-800 hover:text-white"
          >
            <Info size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </>
  );
}
