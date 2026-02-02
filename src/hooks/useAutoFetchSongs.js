import { useEffect } from "react";
import { identifySong } from "../api/API";
import { MESH_CONFIG } from "../utils/Config";

const useAutoFetchSongs = (currentZoom, coordsRef, songsRef) => {
  // Memoize the derived grid values so the effect doesn't fire too often

  /**
   *  ----- World controls -----
   * Since the zoom is float and it triggers even
   * in fractions of zoom level changes
   * This was the fix I thought of...
   * */
  const zoomStep = Math.round(currentZoom * 5) / 5; // Changes every 0.2 zoom units
  const gridX = Math.round(coordsRef.current.x * 10) / 10; // Changes every 0.1 world units
  const gridY = Math.round(coordsRef.current.y * 10) / 10;

  useEffect(() => {
    // Zoom Gate
    if (currentZoom < MESH_CONFIG.ZOOM_THRESHOLD) {
      if (songsRef.current.length > 0) {
        songsRef.current = [];
      }
      return;
    }

    // Debounced Fetch
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
  }, [currentZoom, zoomStep, gridX, gridY, coordsRef, songsRef]);
};

export default useAutoFetchSongs;
