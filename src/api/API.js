import { API_URL } from "../utils/Constants";

// For calling the latest active coordinates from the server
// This file is not the baked coordinates
export async function loadCoords() {
  const res = await fetch(`${API_URL}/songs/coords`);
  const buffer = await res.arrayBuffer();
  return new Float32Array(buffer); // 2 floats per song
}

// This is the API that calls baked coordinates
// But if the size is selected small then load from frontend
export const loadMeshFromBackend = async ({ size }) => {
  let response = {};
  if (size === "S_NUM_POINTS") {
    response = await fetch("/dataset/sm/sm_coords.bin");
  } else if (size === "M_NUM_POINTS") {
    response = await fetch("/dataset/m/m_coords.bin");
  } else if (size === "L_NUM_POINTS") {
    response = await fetch("/dataset/l/l_coords.bin");
  } else {
    // Added timestamp to the URL to prevent caching
    response = await fetch(`${API_URL}/load-mesh/?t=${Date.now()}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const meshData = new Float32Array(arrayBuffer);
  return meshData;
};

// --- Just read the name ---
// Identifies songs for a an area
export const identifySong = async (x, y, k) => {
  const response = await fetch(`${API_URL}/i?x=${x}&y=${y}&k=${k}`);
  const data = await response.json();
  return data;
};
