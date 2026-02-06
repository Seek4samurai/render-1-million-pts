import { ChevronLeft, Cpu, Play, Settings2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Mesh from "./Components/Mesh";

const Canvas = () => {
  const navigate = useNavigate();

  const [render, setRender] = useState(false);
  const [points, setPoints] = useState("M_NUM_POINTS");
  const [isHovered, setIsHovered] = useState(null);

  const [loading, setLoading] = useState(false); // New loading state
  const [progress, setProgress] = useState(0); // For the progress bar

  const handleStart = () => {
    setLoading(true);
    let interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setLoading(false);
            setRender(true);
          }, 500);
          return 100;
        }
        return prev + 1;
      });
    }, 10);
  };

  const options = [
    { label: "50k", value: "S_NUM_POINTS", desc: "Potato / Low Power" },
    { label: "100k", value: "M_NUM_POINTS", desc: "Balanced Performance" },
    { label: "500k", value: "L_NUM_POINTS", desc: "High End GPU" },
    { label: "1M", value: "XL_NUM_POINTS", desc: "Experimental / WebGL 2" },
  ];

  return (
    <div className="relative w-full h-full bg-[#0a0a0a] overflow-hidden font-sans">
      {/* --- BACK BUTTON (Persistent in Config and Loading) --- */}
      {!render && (
        <button
          onClick={() => navigate("/")}
          className="absolute top-8 left-8 z-50 flex items-center gap-2 text-gray-500 hover:text-white transition-colors group cursor-pointer"
        >
          <div className="p-1 rounded-full border border-gray-800 group-hover:border-gray-500 transition-colors">
            <ChevronLeft size={14} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Exit Engine</span>
        </button>
      )}

      {render ? (
        <Mesh points={points} />
      ) : loading ? (
        /* --- LOADER --- */
        <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center font-sans">
          <div className="w-64">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-[0.3em] animate-pulse">
                Initializing GPU
              </span>
              <span className="text-white text-[10px] font-mono">{progress}%</span>
            </div>

            {/* Progress Bar Container */}
            <div className="h-[2px] w-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 text-center">
              <p className="text-gray-600 text-[9px] uppercase tracking-widest leading-loose">
                Slow load for initial render <br />
                If stuck check system metrics
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden font-sans">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>

          <div className="relative z-10 w-full max-w-xl px-8">
            {/* Header */}
            <div className="text-center mb-12">
              <Settings2 className="mx-auto text-gray-600 mb-4" size={32} strokeWidth={1} />
              <h2 className="text-white text-3xl font-serif tracking-tight mb-2">
                Engine Configuration
              </h2>
              <p className="text-gray-500 text-xs uppercase tracking-[0.3em]">
                Select Dataset Density
              </p>
            </div>

            {/* Configuration Grid */}
            <div className="grid grid-cols-2 gap-4 mb-12">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPoints(opt.value)}
                  onMouseEnter={() => setIsHovered(opt.value)}
                  onMouseLeave={() => setIsHovered(null)}
                  className={`relative p-6 text-left border rounded-xl transition-all group cursor-pointer ${
                    points === opt.value
                      ? "border-white bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                      : "border-white/10 bg-transparent hover:border-white/30"
                  }`}
                >
                  <span
                    className={`block text-xl font-serif mb-1 ${points === opt.value ? "text-white" : "text-gray-500"}`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-400 transition-colors">
                    {opt.desc}
                  </span>

                  {points === opt.value && (
                    <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Start Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleStart}
                className="group relative flex items-center gap-3 text-white px-12 py-5 rounded-full font-semibold tracking-[0.2em] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <Play size={14} fill="black" />
                Initialize Render
              </button>

              <div className="mt-8 flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-widest">
                <Cpu size={12} />
                <span>Targeting efficient 1,000,000 vertices</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
