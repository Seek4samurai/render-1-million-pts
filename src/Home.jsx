import { ArrowUpRight, Circle, Feather } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  const [status, setStatus] = useState("idle");

  const verifyWebGL = () => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && gl instanceof WebGLRenderingContext) {
      setStatus("supported");
    } else {
      setStatus("unsupported");
    }
  };

  // Dynamic styling based on status
  const getStatusStyles = () => {
    switch (status) {
      case "supported":
        return "green";
      case "unsupported":
        return "red";
      default:
        return "";
    }
  };

  const SpinGPU = () => {
    // Maybe add a small delay or sound effect here later?
    console.log("Spinning up WebGL pipeline...");
    navigate("/canvas");
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Feather size={22} />
          <span>Lumina</span>
        </div>
        <div className="hidden md:flex gap-10 text-[11px] uppercase tracking-[0.2em] font-semibold text-gray-400">
          <a href="#" className="hover:text-black transition-colors duration-300">
            Document
          </a>
          <a href="#" className="hover:text-black transition-colors duration-300">
            Dataset
          </a>
          <a href="#" className="hover:text-black transition-colors duration-300">
            GitHub
          </a>
        </div>
        <button
          onClick={verifyWebGL}
          className={`pb-1 text-[10px] text-white flex flex-row items-center`}
        >
          Verify WebGL
          <Circle size={20} fill={`${getStatusStyles()}`} className="ml-1" />
        </button>
      </nav>

      {/* Hero Content */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Text Side */}
          <div className="lg:col-span-7">
            <span className="inline-block text-orange-600 font-medium tracking-[0.25em] uppercase text-[10px] mb-6">
              Requires WebGL support
            </span>

            <h1 className="text-6xl md:text-8xl font-serif leading-[0.9] tracking-tighter mb-10">
              How I rendered, <br />
              <span className="italic text-gray-400">1 million pts.</span>
            </h1>

            <p className="max-w-md text-lg text-gray-500 leading-relaxed mb-10">
              Digital grain, rendered in real-time. An exploration of how raw data transforms, given
              GPU support.
            </p>

            <div className="flex items-center gap-8">
              <button
                className="group flex items-center gap-2 bg-[#1A1A1A] text-white px-8 py-4 rounded-full hover:bg-black transition-all"
                onClick={() => SpinGPU()}
              >
                Spin GPU
                <ArrowUpRight
                  size={18}
                  className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                />
              </button>
              <a
                href="#"
                className="text-sm font-semibold border-b border-transparent hover:border-black transition-all"
              >
                Read Story
              </a>
            </div>
          </div>

          {/* Visual Side */}
          <div className="lg:col-span-5 relative">
            <div className="aspect-3/4 overflow-hidden rounded-2xl bg-gray-100 select-none">
              <img
                src="https://images.unsplash.com/photo-1768527858342-037cff722276?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Grid that is pictured as holding dataset?"
                className="cursor-crosshair w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 select-none"
              />
            </div>
            {/* Decorative element */}
            <div className="absolute -bottom-6 -left-6 bg-white p-5 hidden md:block shadow-sm rounded-lg cursor-pointer">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                Run on your system
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
