# One Million Points in the Browser

An experiment in turning a large, model-ready dataset into an interactive GPU visualization without a backend.

This project renders up to **1,000,000 songs** as a navigable point cloud. Each point has a two-dimensional position, a visual value, and a row of metadata. Coordinates are uploaded to the GPU, metadata is decoded with Apache Arrow, spatial queries run through a client-side index, and text search runs in a Web Worker.

The result is a static frontend that can be deployed without an API or database. More importantly, it is a reference architecture for exploring embeddings, clusters, similarity spaces, anomaly maps, and other large ML-derived projections in the browser.

## The experiment

Large scatter plots are easy to describe and surprisingly difficult to make useful. Drawing one million marks is only one part of the problem. The application must also:

- move compact data over the network;
- decode it without turning every row into a heavy JavaScript object;
- keep rendering work on the GPU;
- identify a point under the cursor without scanning the full dataset;
- search metadata without freezing the interface; and
- preserve the relationship between a projected point and its original record.

This repository explores that full path. It treats the browser as a small analytical runtime rather than a thin client for a server-rendered visualization.

## Data model

The current dataset is derived from the [Spotify 12M Songs dataset](https://www.kaggle.com/datasets/rodolfofigueroa/spotify-12m-songs). The checked-in assets contain a prepared one-million-row subset.

Two row-aligned representations are used:

| Representation | Format | Purpose |
| --- | --- | --- |
| Point data | packed `Float32Array` binary | GPU position and visual value: `[x, y, energy]` |
| Song metadata | Apache Arrow IPC | title, artist, album, year, cover URL, tempo, energy, danceability, valence, loudness, and related fields |

The row number is the shared identity. Point `n` in the coordinate buffer corresponds to row `n` in the Arrow table. That simple contract avoids IDs in the GPU buffer and makes a spatial hit directly resolvable to metadata.

The million-row assets are divided into nine shards of roughly 111,112 records. Sharding allows the selected 50K, 100K, 500K, or 1M density to load only the required prefix of the data and avoids a single oversized static asset.

## Runtime architecture

```text
static coordinate shards ──> Float32Array ──> WebGL buffer ──> vertex/fragment shaders
          │                       │
          │                       └──────────> KDBush spatial index ──> hover/click lookup
          │
static Arrow shards ───────> Arrow tables ───────────────────> point metadata panel
          │
          └───────────────> Web Worker text index ───────────> song/artist search
```

All of these operations happen in the browser. The active visualization does not call the companion backend; the older API helpers remain only as historical reference.

### GPU rendering

The coordinate data is uploaded once as a packed vertex buffer. Each vertex contains three 32-bit floats:

```text
x position | y position | energy
```

The vertex shader applies pan, zoom, and aspect-ratio correction, then calculates point size. The fragment shader maps the third value to color. A hovered point is enlarged and can be rendered with its cover image as a texture.

This keeps the per-frame path small: update a few uniforms, bind the existing buffers and texture, and issue one `gl.drawArrays(gl.POINTS, ...)` call. React manages controls and detail panels, but it does not render or reconcile one million point components.

### Spatial queries

At load time, the browser builds a static KDBush index over the projected `x` and `y` coordinates. Pointer positions are transformed from screen space back into world space and queried against that index. The returned row index is then used to retrieve the matching Arrow record.

This replaces a full scan on every mouse movement with a spatial lookup and makes local hover interaction possible without a server-side nearest-neighbor endpoint.

### Metadata search

Song titles and artists are normalized and indexed in a dedicated Web Worker. Queries are debounced and evaluated away from the main UI thread. Results retain their source row number, so selecting one can resolve both its coordinates and full metadata, then animate the camera to that location.

The current search is intentionally simple: exact title, title prefix, and substring matching with a small result limit. It is a useful baseline for testing how far browser-only search can go before a more specialized index becomes worthwhile.

## What this demonstrates

- **A million points do not require a million UI elements.** A single GPU buffer and draw call are a better match for dense marks than DOM or component-based rendering.
- **Data layout matters as much as rendering code.** Packed numeric buffers minimize upload cost, while Arrow keeps columnar metadata queryable without JSON expansion.
- **Stable row alignment is a powerful join strategy.** Coordinate, metadata, search, and selection layers can share one integer index.
- **Client-side querying is practical when the data is static.** Spatial indexing and worker-based text search remove the backend from the interaction loop.
- **Rendering and analysis should be separated.** The GPU draws the overview; CPU indexes answer interaction queries; React presents the application state.
- **The bottleneck moves.** Once drawing is cheap, initial transfer, Arrow decoding, index construction, memory pressure, and image loading become the interesting constraints.

This repository does not claim universal benchmark results. Performance depends on the selected density, browser, GPU, available memory, device pixel ratio, and cache state. The built-in monitor exposes FPS, frame time, an estimated WebGL allocation, JavaScript heap data when the browser allows it, and renderer information.

## ML and data-science utility

The renderer is projection-agnostic. It does not require the source coordinates to come from a particular algorithm. Any pipeline that produces a stable `(x, y, value)` tuple per record can use the same frontend contract.

Possible inputs include:

- UMAP, t-SNE, or PCA projections of high-dimensional embeddings;
- latent spaces from image, audio, text, or multimodal models;
- vector-database exports used for visual quality inspection;
- clustering results, with a score or label encoded as color;
- anomaly-detection outputs, where distance or confidence drives emphasis;
- geospatial or simulation data already represented in two dimensions;
- training-set audits for duplicate, sparse, mislabeled, or isolated samples; and
- experiment comparisons where different projections reuse the same metadata.

The application is especially useful as the inspection layer after an offline ML job. Training, embedding generation, dimensionality reduction, and coordinate normalization can happen in Python or another data pipeline. The browser only needs the final binary coordinates and row-aligned Arrow metadata.

## Future directions

This method can grow beyond the current music dataset. Useful next experiments include:

- progressive and viewport-aware shard loading instead of loading a density prefix;
- level-of-detail buffers for faster overview rendering;
- GPU or worker-based filtering by cluster, label, score, or metadata field;
- approximate semantic search backed by quantized embeddings;
- lasso selection and export for dataset curation workflows;
- linked views for comparing multiple embedding models or checkpoints;
- WebGL 2 instancing, transform feedback, or WebGPU compute/render pipelines;
- compressed coordinate formats and dictionary-encoded metadata;
- persistent browser caching for large static shards;
- off-main-thread spatial-index construction; and
- a generic manifest format so new datasets can be loaded without changing application code.

A natural production architecture would keep the same renderer while choosing the data strategy by scale: fully static assets for small-to-medium snapshots, range requests or object-storage shards for larger collections, and a vector service only when the dataset or query semantics truly require it.

## Run the experiment

### Requirements

- Node.js 20.19+ or 22.12+
- npm
- A modern browser with WebGL support

Python is only needed to modify or regenerate the prepared data assets.

### Development

```bash
git clone https://github.com/Seek4samurai/render-1-million-pts.git
cd render-1-million-pts
npm install
npm run dev
```

Open `http://localhost:3000`, select a density, and initialize the render. No backend process is required.

### Production

```bash
npm run build
npm run preview
```

The generated `dist/` directory can be deployed to a static host. Configure an `index.html` fallback for `/canvas` because routing happens in the browser.

## Explore the visualization

- Drag to pan and use the wheel or trackpad to zoom.
- Hover a point after zooming in to inspect it.
- Click a point to center it and open its metadata.
- Search by title or artist; press `/` to focus search.
- Use `↑` and `↓` to navigate results and `Enter` to locate one.
- Toggle the live system monitor from the upper-right controls.
- Press `Esc` to clear search or close the selected-song panel.

Start with 50K or 100K on lower-power devices. Higher densities require more transfer, parsing, indexing, and browser memory. The complete static shard set is approximately 280 MB before browser caching and in-memory representation. Cover artwork and outbound YouTube search use third-party network resources, but the visualization data itself is local.

## Project scripts

```bash
npm run dev      # Start Vite on port 3000
npm run build    # Build the static application
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
```

The Python utilities in `src/functions/` inspect Parquet schemas, convert metadata to Arrow, and split coordinate and metadata files into aligned shards. They are data-preparation tools, not runtime dependencies.

## Further reading

The repository includes a short [implementation document](public/document/render_1m_points_document.pdf) with additional project context.
