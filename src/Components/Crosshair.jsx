const Crosshair = () => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      {/* Center Crosshair */}
      <div className="absolute flex items-center justify-center">
        <div className="w-4 h-px bg-white/80" />
        <div className="absolute h-4 w-px bg-white/80" />
      </div>
    </div>
  );
};

export default Crosshair;
