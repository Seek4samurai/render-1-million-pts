import { ArrowUpRight, Database, LoaderCircle, LocateFixed, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SongSearch = ({ maxIndex, onSelect, disabled = false, visible = true }) => {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("loading");
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState({
    loaded: 0,
    total: Math.min(9, Math.ceil(maxIndex / 111112)),
  });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/songSearch.worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "progress") setProgress(message);
      if (message.type === "ready") setStatus("ready");
      if (message.type === "error") setStatus("error");
      if (message.type === "results" && message.requestId === requestIdRef.current) {
        setResults(message.results);
        setActiveIndex(0);
        setSearching(false);
      }
    });

    worker.postMessage({ type: "init", maxIndex });
    return () => worker.terminate();
  }, [maxIndex]);

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (event.key === "/" && !isTyping && status === "ready" && visible) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [status, visible]);

  useEffect(() => {
    if (status !== "ready") return undefined;

    if (query.trim().length < 2) return undefined;

    const timeout = window.setTimeout(() => {
      requestIdRef.current += 1;
      workerRef.current?.postMessage({
        type: "search",
        query,
        maxIndex,
        requestId: requestIdRef.current,
      });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [query, maxIndex, status]);

  const clearSearch = () => {
    requestIdRef.current += 1;
    setQuery("");
    setResults([]);
    setSearching(false);
    setActiveIndex(0);
    setOpen(false);
  };

  const chooseResult = (result) => {
    onSelect(result.id);
    clearSearch();
  };

  const isIndexing = status === "loading";
  const hasQuery = query.trim().length >= 2;

  return (
    <div
      ref={rootRef}
      className={`absolute top-5 left-1/2 z-40 w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 transition-all duration-200 ${
        !visible
          ? "pointer-events-none -translate-y-3 opacity-0"
          : disabled
            ? "pointer-events-none opacity-45"
            : "opacity-100"
      }`}
    >
      <div
        className={`relative overflow-hidden border bg-[#080a0b]/92 shadow-[0_20px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition-all duration-200 ${
          open
            ? "rounded-[20px] border-white/18 ring-1 ring-cyan-300/5"
            : "rounded-2xl border-white/10 hover:border-white/16"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />

        <div className="flex h-14 items-center gap-3 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4">
          {searching || isIndexing ? (
              <LoaderCircle size={15} className="animate-spin text-cyan-200/75" />
          ) : (
              <Search size={15} className="text-white/45" />
          )}
          </div>

          <input
            ref={inputRef}
            value={query}
            disabled={!visible || disabled || isIndexing || status === "error"}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim().length < 2) {
                requestIdRef.current += 1;
                setResults([]);
                setSearching(false);
              } else {
                setSearching(true);
              }
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                clearSearch();
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && results[activeIndex]) {
                chooseResult(results[activeIndex]);
              }
            }}
            placeholder={
              isIndexing
                ? `Indexing songs ${progress.loaded}/${progress.total}…`
                : status === "error"
                  ? "Search index unavailable"
                  : "Search a song or artist…"
            }
            aria-label="Search loaded songs"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-medium tracking-[0.01em] text-white/90 outline-none placeholder:font-normal placeholder:text-white/28 disabled:cursor-wait"
          />

          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X size={14} />
            </button>
          )}

          <div className="hidden shrink-0 items-center gap-2 border-l border-white/8 pl-3 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
            <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/30">
              {maxIndex / 1000}K indexed
            </span>
            {!query && (
              <kbd className="ml-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] text-white/30">
                /
              </kbd>
            )}
          </div>
        </div>

        {open && hasQuery && status !== "loading" && (
          <div className="border-t border-white/7">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/24">
                <Database size={10} /> Loaded dataset
              </span>
              {!searching && results.length > 0 && (
                <span className="font-mono text-[8px] text-white/20">
                  {results.length} matches
                </span>
              )}
            </div>

            {results.length > 0 ? (
              <div className="max-h-[390px] space-y-1 overflow-y-auto px-2 pb-2">
                {results.map((result, index) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => chooseResult(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      activeIndex === index
                        ? "border-cyan-200/12 bg-cyan-200/7"
                        : "border-transparent hover:bg-white/5"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-cyan-100/60 transition-colors group-hover:border-cyan-200/15 group-hover:text-cyan-100">
                      <LocateFixed size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-white/88">
                        {result.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.17em] text-white/30">
                        {result.artists}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[8px] text-white/16">#{result.id}</span>
                      <ArrowUpRight
                        size={13}
                        className={`transition-all ${
                          activeIndex === index
                            ? "translate-x-0 text-cyan-100/60 opacity-100"
                            : "-translate-x-1 text-white/20 opacity-0"
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            ) : searching ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-[9px] uppercase tracking-[0.22em] text-white/25">
                <LoaderCircle size={12} className="animate-spin text-cyan-200/50" />
                Scanning loaded dataset
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-[11px] font-medium text-white/45">No matching song found</p>
                <p className="mt-1 text-[9px] tracking-wide text-white/20">
                  Try a title or artist available in the current density.
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div className="flex items-center justify-between border-t border-white/6 px-4 py-2.5 font-mono text-[8px] text-white/18">
                <span>↑↓ Navigate · Enter locate</span>
                <span>Esc close</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SongSearch;
