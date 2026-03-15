import * as Arrow from "apache-arrow";
import KDBush from "kdbush";
import { useEffect, useRef, useState } from "react";
import useCanvasEvents from "../hooks/useCanvasEvents";
import useGPS from "../hooks/useGPS";
import { MESH_CONFIG } from "../utils/Config";
import { createProgram, initPlaceholderTexture } from "../webgl/GLUtils";
import { fs, vs } from "../webgl/Shaders";
import Crosshair from "./Crosshair";
import Preview from "./Preview";
import Song from "./Song";

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

  useEffect(() => {
    const loadData = async () => {
      const numParts = 9; // Indices 0, 1, 2, 3, 4, 5, 6, 7, 8
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
    props.size
  );

  // ------------ Main UseEffect / Function ------------
  // Previously this was useEffect but now its a function
  // So we call it after the mesh coords loading is done
  const textureCache = useRef(new Map());

  const startWebGL = () => {
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
        {/* The WebGL Canvas */}
        <canvas
          ref={canvasRef}
          className="w-[95vw] h-[95vh] rounded-2xl cursor-grab active:cursor-grabbing touch-none border border-white/5"
        />

        <Song selectedSong={selectedSong} onClear={() => setSelectedSong(null)} />

        <Crosshair></Crosshair>

        {hoveredSong && <Preview mousePx={mousePx} hoveredSong={hoveredSong}></Preview>}

        {/* Bottom-Left Coordinate HUD */}
        <div className="absolute bottom-10 left-15 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/5 text-white/80 text-xs font-mono shadow-lg">
          <span className="text-blue-400">POS:</span> {coords.x}, {coords.y}
          <span className="mx-2 text-white/20">|</span>
          <span className="text-emerald-400">ZOOM:</span> {currentZoom.toFixed(2)}x
        </div>
      </div>
    </>
  );
}
