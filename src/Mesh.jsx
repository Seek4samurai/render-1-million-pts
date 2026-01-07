import { useEffect, useRef, useState } from "react";
import { loadCoords } from "./functions/loadcsv";

export default function Mesh() {
  const canvasRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  function clampPan(t) {
    // Allow the offset to go slightly further so corners aren't stuck off-screen
    const limit = 2;
    t.x = Math.min(limit, Math.max(-limit, t.x));
    t.y = Math.min(limit, Math.max(-limit, t.y));
  }

  const transform = useRef({
    x: 0.0,
    y: 0.0,
    scale: 0.5,
    targetScale: 0.5,
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    let animationFrameId;

    // ---- SHADERS ----
    const vs = `
      attribute vec3 aData;
      uniform float uAspect;
      uniform vec2 uOffset;
      uniform float uScale;
      varying float vEnergy;

      void main() {
          vec2 pos = aData.xy;
          vEnergy = aData.z;

          // Spiral Math (Center-anchored)
          vec2 centeredPos = (pos / 500.0) - 1.0;

          float r = length(centeredPos);
          float theta = atan(centeredPos.y, centeredPos.x);

          // This adds a tiny random offset to the radius based on the unique X,Y of the point
          r += (fract(sin(dot(centeredPos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.05;

          theta += r * 10.0; 

          vec2 swirledPos = vec2(cos(theta) * r, sin(theta) * r);

          // Interaction (Pan/Zoom)
          float baseScale = 10.0;
          vec2 transformedPos = (swirledPos + uOffset) * (uScale * baseScale);

          transformedPos.x /= uAspect;

          gl_Position = vec4(transformedPos, 0.0, 1.0);
          gl_PointSize = max(1.0, 2.0 * uScale);
      }
    `;

    const fs = `
      precision mediump float;
      varying float vEnergy;

      void main() {
          float h = vEnergy;
          float s = 1.0;
          float l = 0.5;
          float c = (1.0 - abs(2.0 * l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
          float m = l - c / 2.0;
          vec3 rgb;

          if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
          else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
          else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
          else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
          else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
          else rgb = vec3(c, 0.0, x);

          gl_FragColor = vec4(rgb + m, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Shader Error:", gl.getShaderInfoLog(s));
      }
      return s;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const aspectLoc = gl.getUniformLocation(program, "uAspect");
    const offsetLoc = gl.getUniformLocation(program, "uOffset");
    const scaleLoc = gl.getUniformLocation(program, "uScale");
    const dataLoc = gl.getAttribLocation(program, "aData");

    // --- INTERACTION EVENTS ---
    const handleWheel = (e) => {
      e.preventDefault();
      // const zoomSpeed = 0.1;
      const zoomSpeed = 0.005; // smaller = smoother
      transform.current.targetScale *= Math.exp(-e.deltaY * zoomSpeed);
      transform.current.targetScale = Math.min(
        50,
        Math.max(0.25, transform.current.targetScale)
      );
    };

    const handleMouseDown = (e) => {
      transform.current.isDragging = true;
      transform.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!transform.current.isDragging) {
        // Even if not dragging, calculate world pos for the HUD
        const rect = canvas.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        const my = -(((e.clientY - rect.top) / canvas.clientHeight) * 2 - 1);

        const aspect = canvas.width / canvas.height;
        const t = transform.current;

        // same math as your Vertex Shader
        const worldX = ((mx * aspect) / (t.scale * 8.0) - t.x + 1.0) * 500;
        const worldY = (1.0 - (my / (t.scale * 8.0) - t.y)) * 500;

        setCoords({ x: Math.round(worldX), y: Math.round(worldY) });
        return;
      }

      if (!transform.current.isDragging) return;

      const dx = e.clientX - transform.current.lastMouse.x;
      const dy = e.clientY - transform.current.lastMouse.y;

      // Adjust pan sensitivity based on scale
      transform.current.x +=
        ((dx / canvas.clientWidth) * 1.0) / transform.current.scale;
      transform.current.y -=
        ((dy / canvas.clientHeight) * 1.0) / transform.current.scale;

      transform.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      transform.current.isDragging = false;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    const run = async () => {
      const coordsRaw = await loadCoords();
      const numPointsToUse = 500000;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, coordsRaw, gl.STATIC_DRAW);

      gl.enableVertexAttribArray(dataLoc);
      gl.vertexAttribPointer(dataLoc, 3, gl.FLOAT, false, 0, 0);

      const render = () => {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== canvas.clientWidth * dpr) {
          canvas.width = canvas.clientWidth * dpr;
          canvas.height = canvas.clientHeight * dpr;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // smooth zoom
        const t = transform.current;
        t.scale += (t.targetScale - t.scale) * 0.05;
        clampPan(transform.current);

        gl.useProgram(program);

        // Now these locations are guaranteed to be from the "associated program"
        gl.uniform1f(aspectLoc, canvas.width / canvas.height);
        gl.uniform2f(offsetLoc, transform.current.x, transform.current.y);
        gl.uniform1f(scaleLoc, transform.current.scale);

        gl.drawArrays(gl.POINTS, 0, numPointsToUse);
        animationFrameId = requestAnimationFrame(render);
      };

      render();
    };

    run();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100vw",
        height: "100vh",
      }}
    >
      <canvas
        ref={canvasRef}
        className="rounded-2xl cursor-move touch-none"
        style={{ width: "95vw", height: "95vh" }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          color: "white",
          background: "rgba(0,0,0,0.5)",
          padding: "10px",
        }}
      >
        Song Space: {coords.x}, {coords.y}
        <br />
        {coords.x < 100 && coords.y < 100
          ? "📍 Top-Left (Low Energy/Dance)"
          : ""}
      </div>
    </div>
  );
}

