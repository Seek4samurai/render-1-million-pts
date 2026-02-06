/**
 * This file contains all the mouse/canvas interactions
 * NOTE -> Some state updates are here
 **/
import { useEffect } from "react";
import { MESH_CONFIG } from "../utils/Config";

const useCanvasEvents = (
  coordsRef,
  canvasRef,
  songsRef,
  transformRef,
  hoveredSongRef,
  setSelectedSong,
  setCoords,
  setHoveredSong,
  setMousePx
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- 1. Click on a song Logic ---
    const handleClickOnSong = () => {
      if (hoveredSongRef.current) {
        const song = hoveredSongRef.current;
        const t = transformRef.current;

        console.log(hoveredSongRef.current);
        setSelectedSong(hoveredSongRef.current);

        t.targetScale = 4.0;

        // We set the target coordinates.
        // IMPORTANT: Because of how shader math works,
        // we set the camera offset to the NEGATIVE of the song's position
        // so the song ends up at (0,0) in the center of the screen.
        t.targetX = -song.x;
        t.targetY = -song.y;
      }
    };

    // --- 2. Scroll Zoom Logic ---
    const handleWheelZoom = (e) => {
      e.preventDefault();
      const t = transformRef.current;
      t.targetScale *= Math.exp(-e.deltaY * MESH_CONFIG.ZOOM_SPEED);

      // Min/Max Zoom constraints
      t.targetScale = Math.min(
        MESH_CONFIG.MAX_ZOOM_IN,
        Math.max(MESH_CONFIG.MAX_ZOOM_OUT, t.targetScale)
      );
    };

    // Below 3,4,5 helps in mouse drag ability
    // --- 3. Dragging logic ---
    const handleMouseUp = () => {
      const t = transformRef.current;
      t.isDragging = false;
    };

    // --- 4. Dragging logic ---
    const handleMouseDown = (e) => {
      const t = transformRef.current;
      t.isDragging = true;
      t.lastMouse = { x: e.clientX, y: e.clientY };

      t.targetX = t.x;
      t.targetY = t.y;
    };
    // This makes the window draggable only when mouse click is hold

    // --- 5. Dragging logic ---
    const handleMouseMove = (e) => {
      const t = transformRef.current;
      const rect = canvas.getBoundingClientRect();

      if (!t.isDragging) {
        const mx = ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        const my = -(((e.clientY - rect.top) / canvas.clientHeight) * 2 - 1);
        const aspect = canvas.width / canvas.height;

        const worldX = (mx * aspect) / (t.scale * 10.0) - t.x;
        const worldY = my / (t.scale * 10.0) - t.y;

        coordsRef.current = { x: worldX, y: worldY };
        setCoords({ x: worldX.toFixed(3), y: worldY.toFixed(3) });
        setMousePx({ x: e.clientX, y: e.clientY });

        // --- TESTING NEW HOVER LOGIC ---
        let found = null;
        // The "hitbox" size. Adjust 0.005 to make it easier or harder to hover.
        // --- TODO ----
        // Make this value dynamic according to the zoom level
        const threshold = 0.005 / t.scale;

        // Optimized Search: Only loop if songs exist
        if (songsRef.current) {
          for (const song of songsRef.current) {
            const dx = worldX - song.x;
            const dy = worldY - song.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < threshold) {
              found = song;
              break; // Stop at first match
            }
          }
        }

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

      // If Dragging: Handle Panning
      const dx = e.clientX - t.lastMouse.x;
      const dy = e.clientY - t.lastMouse.y;
      // Adjust pan sensitivity based on scale
      t.x += ((dx / canvas.clientWidth) * 1.0) / t.scale;
      t.y -= ((dy / canvas.clientHeight) * 1.0) / t.scale;
      t.lastMouse = { x: e.clientX, y: e.clientY };
    };

    // Attach listeners
    canvas.addEventListener("click", handleClickOnSong);
    canvas.addEventListener("wheel", handleWheelZoom, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    // Cleanups
    return () => {
      canvas.removeEventListener("click", handleClickOnSong);
      canvas.removeEventListener("wheel", handleWheelZoom);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
    };
  }, [
    canvasRef,
    transformRef,
    hoveredSongRef,
    songsRef,
    coordsRef,
    setCoords,
    setHoveredSong,
    setSelectedSong,
    setMousePx,
  ]);
};

export default useCanvasEvents;
