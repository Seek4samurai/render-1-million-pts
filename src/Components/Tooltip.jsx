const Tooltip = ({ mousePx, hoveredSong }) => {
  return (
    <>
      <div
        className="fixed pointer-events-none z-50 bg-black/90 border border-white/10 p-3 rounded-lg shadow-2xl backdrop-blur-md text-white"
        style={{
          left: mousePx.x + 15,
          top: mousePx.y + 15,
          minWidth: "200px",
        }}
      >
        <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">
          Song Data
        </div>
        <h4 className="text-sm font-bold truncate">{hoveredSong.data.name}</h4>
        <p className="text-xs text-neutral-400 truncate">
          {hoveredSong.data.artists}
        </p>

        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] font-mono text-neutral-500">
          <span>Energy: {hoveredSong.data.energy.toFixed(2)}</span>
          <span>{hoveredSong.data.year}</span>
        </div>
      </div>
    </>
  );
};

export default Tooltip;
