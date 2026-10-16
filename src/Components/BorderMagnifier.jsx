import { useEffect, useRef } from "react";

const MAGNIFICATION = 3.5;

const BorderMagnifier = ({ sourceCanvasRef }) => {
  const borderCanvasRef = useRef(null);

  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    if (!sourceCanvas || !borderCanvas) return undefined;

    const context = borderCanvas.getContext("2d");
    if (!context) return undefined;

    let animationFrameId;

    const renderBorders = () => {
      const dpr = window.devicePixelRatio || 1;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.round(viewportWidth * dpr);
      const height = Math.round(viewportHeight * dpr);

      if (borderCanvas.width !== width || borderCanvas.height !== height) {
        borderCanvas.width = width;
        borderCanvas.height = height;
      }

      const rect = sourceCanvas.getBoundingClientRect();
      const left = rect.left * dpr;
      const top = rect.top * dpr;
      const canvasWidth = rect.width * dpr;
      const canvasHeight = rect.height * dpr;
      const rightGutter = width - left - canvasWidth;
      const bottomGutter = height - top - canvasHeight;
      const sourceScaleX = sourceCanvas.width / rect.width;
      const sourceScaleY = sourceCanvas.height / rect.height;

      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.globalAlpha = 1;

      // Reflect a narrow, magnified slice of each canvas edge into its black gutter.
      if (top > 0) {
        const sourceHeight = Math.max(1, (top / dpr / MAGNIFICATION) * sourceScaleY);
        context.save();
        context.translate(0, top);
        context.scale(1, -1);
        context.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceHeight,
          left,
          0,
          canvasWidth,
          top
        );
        context.restore();
      }

      if (bottomGutter > 0) {
        const sourceHeight = Math.max(
          1,
          (bottomGutter / dpr / MAGNIFICATION) * sourceScaleY
        );
        context.save();
        context.translate(0, top + canvasHeight);
        context.scale(1, -1);
        context.drawImage(
          sourceCanvas,
          0,
          sourceCanvas.height - sourceHeight,
          sourceCanvas.width,
          sourceHeight,
          left,
          -bottomGutter,
          canvasWidth,
          bottomGutter
        );
        context.restore();
      }

      if (left > 0) {
        const sourceWidth = Math.max(1, (left / dpr / MAGNIFICATION) * sourceScaleX);
        context.save();
        context.translate(left, 0);
        context.scale(-1, 1);
        context.drawImage(
          sourceCanvas,
          0,
          0,
          sourceWidth,
          sourceCanvas.height,
          0,
          top,
          left,
          canvasHeight
        );
        context.restore();
      }

      if (rightGutter > 0) {
        const sourceWidth = Math.max(
          1,
          (rightGutter / dpr / MAGNIFICATION) * sourceScaleX
        );
        context.save();
        context.translate(left + canvasWidth, 0);
        context.scale(-1, 1);
        context.drawImage(
          sourceCanvas,
          sourceCanvas.width - sourceWidth,
          0,
          sourceWidth,
          sourceCanvas.height,
          -rightGutter,
          top,
          rightGutter,
          canvasHeight
        );
        context.restore();
      }

      context.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(renderBorders);
    };

    renderBorders();
    return () => cancelAnimationFrame(animationFrameId);
  }, [sourceCanvasRef]);

  return <canvas ref={borderCanvasRef} aria-hidden="true" className="border-magnifier" />;
};

export default BorderMagnifier;
