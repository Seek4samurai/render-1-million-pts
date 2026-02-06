import { MESH_CONFIG } from "../utils/Config";

const useGPS = (currentZoom, setCurrentZoom) => {
  /**
   * Clamps the panning coordinates to the world limits
   */
  const clampPan = (t) => {
    t.x = Math.min(MESH_CONFIG.LIMIT, Math.max(-MESH_CONFIG.LIMIT, t.x));
    t.y = Math.min(MESH_CONFIG.LIMIT, Math.max(-MESH_CONFIG.LIMIT, t.y));
  };

  /**
   * updateTransform: This should be called inside the RequestAnimationFrame loop.
   */
  const updateTransform = (transformRef) => {
    const t = transformRef.current;

    // Smooth interpolation (Lerp) for zoom
    t.scale += (t.targetScale - t.scale) * 0.05;

    if (t.isDragging) {
      // WHILE DRAGGING: Keep target synced with manual movement
      t.targetX = t.x;
      t.targetY = t.y;
    } else {
      // WHILE IDLE: Chase the target (Auto-focus)
      t.x += (t.targetX - t.x) * 0.1;
      t.y += (t.targetY - t.y) * 0.1;
    }

    // Apply boundaries
    clampPan(t);

    if (Math.abs(t.scale - currentZoom) > 0.01) {
      setCurrentZoom(t.scale);
    }
  };

  return { updateTransform };
};

export default useGPS;
