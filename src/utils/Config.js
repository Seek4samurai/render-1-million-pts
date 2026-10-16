export const MESH_CONFIG = {
  /**
   * World Boundaries
   * Logic reference:
   * const clampPan = (t) => {
   * const limit = MESH_CONFIG.LIMIT;
   * t.x = Math.min(limit, Math.max(-limit, t.x));
   * t.y = Math.min(limit, Math.max(-limit, t.y));
   * };
   */
  // Baked coordinates reach approximately +/-4.18 even in the smaller datasets.
  // Keep enough camera travel to center every searchable point.
  NORMAL_LIMIT: 4.5,
  LARGE_LIMIT: 4.5,

  /**
   * Zoom Gate
   * Logic reference:
   * if (currentZoom < MESH_CONFIG.ZOOM_THRESHOLD) {
   * if (songsRef.current.length > 0) songsRef.current = [];
   * return;
   * }
   */
  ZOOM_THRESHOLD: 1.0,

  /**
   * Rendering Density
   * 4 different sizes based on the configuration
   * Logic reference:
   * gl.drawArrays(gl.POINTS, 0, MESH_CONFIG.S_NUM_POINTS);
   */
  S_NUM_POINTS: 50000,
  M_NUM_POINTS: 100000,
  L_NUM_POINTS: 500000,
  XL_NUM_POINTS: 1000000,

  /**
   * Zoom Sensitivity
   * Logic reference:
   * transform.current.targetScale *= Math.exp(-e.deltaY * MESH_CONFIG.ZOOM_SPEED);
   */
  ZOOM_SPEED: 0.005,

  /**
   * Zoom parameters
   * Logic reference:
   * transform.current.targetScale = Math.min(50, Math.max(0.25, t.targetScale));
   */
  MAX_ZOOM_IN: 50,
  MAX_ZOOM_OUT: 0.05,
};
