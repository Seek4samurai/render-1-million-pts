const Preview = ({ mousePx, hoveredSong }) => {
  // For some reason the dataset has artist's names in strigified list
  // To get list out of that this function is used in this
  const parseArtists = (str) => {
    return str
      .replace(/^\[|\]$/g, "") // remove [ ]
      .split(",")
      .map((s) => s.trim())
      .map((s) => s.replace(/^'|'$/g, ""));
  };

  const artists = parseArtists(hoveredSong?.data?.artists);

  return (
    <>
      <div
        className={`fixed pointer-events-none w-125 z-50 p-4 rounded-xl shadow-2xl text-white backdrop-blur-md transition-opacity duration-300 ${hoveredSong ? "opacity-100" : "opacity-0"}`}
        style={{ left: mousePx.x + 15, top: mousePx.y + 15 }}
      >
        <h3 className="text-md text-gray-300 font-semibold leading-tight flex flex-wrap">
          {hoveredSong.data.album}
        </h3>
        <div className="">
          <h3 className="text-3xl font-bold">{hoveredSong.data.name}</h3>
          <h4 className="text-xl font-bold text-gray-300">
            ({hoveredSong.data.year})
          </h4>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          {artists.map((artist, i) => (
            <span key={artist}>
              {artist}
              {i < artists.length - 1 && ", "}
            </span>
          ))}
        </p>

        <div className="mt-3 pt-2 border-t border-white/20 flex gap-3 text-[10px] font-normal text-black">
          <span className="bg-white p-1 rounded-md">
            {(hoveredSong.data.energy * 100).toFixed(0)}% Energy
          </span>
          <span className="bg-white p-1 rounded-md">
            {(hoveredSong.data.danceability * 100).toFixed(0)}% Danceability
          </span>
        </div>
      </div>
    </>
  );
};

export default Preview;
