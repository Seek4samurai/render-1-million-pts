import * as Arrow from "apache-arrow";

const SHARD_COUNT = 9;
const RESULT_LIMIT = 8;

let shards = [];
let searchableRows = [];
let ready = false;

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['[\]]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const loadIndex = async (maxIndex) => {
  try {
    let offset = 0;
    const requiredShards = Math.min(SHARD_COUNT, Math.ceil(maxIndex / 111112));

    for (let part = 0; part < requiredShards; part += 1) {
      const response = await fetch(`/dataset/xl/shards/xl_metadata_part${part}.arrow`);
      if (!response.ok) throw new Error(`Could not load metadata shard ${part + 1}`);

      const table = Arrow.tableFromIPC(new Uint8Array(await response.arrayBuffer()));
      const names = table.getChild("name");
      const artists = table.getChild("artists");
      const rowsToIndex = Math.min(table.numRows, maxIndex - offset);

      shards.push({ offset, length: rowsToIndex, names, artists });

      for (let row = 0; row < rowsToIndex; row += 1) {
        searchableRows.push(`${normalize(names.get(row))}\u0000${normalize(artists.get(row))}`);
      }

      offset += rowsToIndex;
      self.postMessage({ type: "progress", loaded: part + 1, total: requiredShards });
    }

    ready = true;
    self.postMessage({ type: "ready", count: searchableRows.length });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};

const getDisplayData = (id) => {
  const shard = shards.find((candidate) => id >= candidate.offset && id < candidate.offset + candidate.length);
  if (!shard) return null;

  const localIndex = id - shard.offset;
  return {
    id,
    name: String(shard.names.get(localIndex) ?? "Unknown title"),
    artists: String(shard.artists.get(localIndex) ?? "Unknown artist").replace(/['[\]]/g, ""),
  };
};

const search = (query, maxIndex, requestId) => {
  if (!ready) return;

  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) {
    self.postMessage({ type: "results", requestId, results: [] });
    return;
  }

  const exact = [];
  const prefix = [];
  const contains = [];
  const cappedIndex = Math.min(maxIndex, searchableRows.length);

  for (let id = 0; id < cappedIndex; id += 1) {
    const searchable = searchableRows[id];
    const separator = searchable.indexOf("\u0000");
    const title = searchable.slice(0, separator);

    if (title === normalizedQuery) exact.push(id);
    else if (title.startsWith(normalizedQuery)) prefix.push(id);
    else if (searchable.includes(normalizedQuery) && contains.length < RESULT_LIMIT) contains.push(id);

    if (exact.length + prefix.length >= RESULT_LIMIT) break;
  }

  const ids = [...exact, ...prefix, ...contains].slice(0, RESULT_LIMIT);
  self.postMessage({
    type: "results",
    requestId,
    results: ids.map(getDisplayData).filter(Boolean),
  });
};

self.addEventListener("message", (event) => {
  const { type, query, maxIndex, requestId } = event.data;
  if (type === "init" && !ready && searchableRows.length === 0) loadIndex(maxIndex);
  if (type === "search") search(query, maxIndex, requestId);
});
