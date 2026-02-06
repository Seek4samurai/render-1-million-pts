import {
  Activity,
  BarChart2,
  Calendar,
  ExternalLink,
  ListMusic,
  Music,
  Play,
  Terminal,
  X,
  Youtube,
  Zap,
} from "lucide-react";

const Metric = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white/3 border border-white/10 rounded-xl h-[85px] w-full p-4 flex flex-col justify-between">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
      <Icon size={12} />
      {label}
    </div>
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-mono text-white/80 leading-none">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-[2px] w-full bg-white/5 overflow-hidden rounded-full">
        <div
          className={`h-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  </div>
);

const Song = ({ selectedSong, onClear }) => {
  if (!selectedSong) return null;

  const { data } = selectedSong;

  return (
    <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 z-50 w-[600px] h-[800px]">
      <div className="h-full w-full backdrop-blur-3xl bg-neutral-950/92 border border-white/10 rounded-[3.5rem] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,0.8)] flex flex-col">
        <div className="relative h-[42%] w-full p-8 pb-0">
          <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden border border-white/10 bg-neutral-900 shadow-inner group cursor-pointer">
            {/* The Pattern Layer */}
            <div
              className="absolute inset-0 opacity-40 transition-transform duration-1000 group-hover:scale-110"
              style={{
                backgroundImage: `url(${data.cover_url})`,
                backgroundRepeat: "repeat",
                backgroundSize: "120px",
              }}
            />

            {/* Main Centered "Focused" Image */}
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/40 backdrop-blur-[2px]">
              <img
                src={data.cover_url}
                className="h-[70%] aspect-square object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10"
                alt="Center Focus"
              />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
          </div>

          <button
            onClick={onClear}
            className="absolute cursor-pointer top-14 right-12 p-3 backdrop-blur-xl bg-black/60 border border-white/20 rounded-full text-white/60 hover:text-white transition-all z-20 hover:scale-110"
          >
            <X size={24} />
          </button>

          <div className="absolute bottom-6 left-14 right-14 z-10">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <Terminal size={14} className="animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.5em] font-black opacity-80">
                Pattern Scan
              </span>
            </div>
            <h3 className="text-3xl font-serif text-white leading-tight mb-1 truncate">
              {data.name}
            </h3>
            <p className="text-white/40 text-[12px] uppercase tracking-[0.3em] font-light truncate">
              {data.artists.replace(/['\[\]]/g, "")}
            </p>
          </div>
        </div>

        <div className="flex-1 p-10 pt-6 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px] font-mono text-white/30 tracking-[0.3em] uppercase">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-orange-500/60" /> {data.year}
            </div>
            <div className="h-[1px] grow mx-6 bg-white/5" />
            <div className="flex items-center gap-2">
              {Math.round(data.tempo)} BPM <Activity size={13} className="text-orange-500/60" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Metric label="Energy" value={data.energy} icon={Zap} color="bg-orange-500" />
            <Metric label="Groove" value={data.danceability} icon={BarChart2} color="bg-blue-500" />
            <Metric label="Mood" value={data.valence} icon={Music} color="bg-emerald-500" />
            <Metric
              label="Power"
              value={Math.min(Math.abs(data.loudness) / 20, 1)}
              icon={Activity}
              color="bg-rose-500"
            />
          </div>

          <div className="flex items-center gap-4 mt-6">
            <button className="flex-1 h-14 bg-white text-black rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs hover:bg-orange-500 transition-colors group cursor-pointer">
              <div className="bg-black text-white p-1 rounded-full group-hover:bg-white group-hover:text-black">
                <Play size={16} fill="currentColor" />
              </div>
              Preview Track
            </button>

            <div className="flex gap-2">
              {[
                { icon: <Youtube size={18} />, color: "hover:text-red-500", label: "YouTube" },
                { icon: <Music size={18} />, color: "hover:text-emerald-500", label: "Spotify" },
                { icon: <ExternalLink size={18} />, color: "hover:text-pink-500", label: "Apple" },
              ].map((platform, i) => (
                <button
                  key={i}
                  className={`w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 transition-all ${platform.color} hover:bg-white/10 hover:border-white/20 cursor-pointer`}
                  title={platform.label}
                >
                  {platform.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <div className="flex items-center gap-4 tracking-[0.4em] truncate border-t border-white/5 pt-6">
              <ListMusic size={14} className="text-white/20" />
              <span className="truncate italic text-white/60 text-[12px] uppercase">
                {data.album}
              </span>
            </div>
            <div className="flex justify-between items-center text-[8px] font-mono text-white/20 tracking-[0.5em] uppercase">
              <span>DB_REF: 1024_SONGS</span>
              <span>NODE_{data.id.substring(0, 10)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Song;
