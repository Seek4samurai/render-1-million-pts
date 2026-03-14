export const encodeId = (id) => {
  return [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255];
};

export const decodeId = (r, g, b) => {
  return r + (g << 8) + (b << 16);
};
