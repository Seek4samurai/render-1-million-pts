// ---- SHADERS ----
export const vs = `
      attribute vec3 aData;
      uniform float uAspect;
      uniform vec2 uOffset;
      uniform float uScale;
      uniform vec2 uHoverPos;
      varying float vIsHover;
      varying float vEnergy;

      void main() {
          // The baked data is already x, y, energy
          vec2 pos = aData.xy; 
          
          // If baked energy is raw (0-500), keep this. 
          // If baked energy is normalized (0-1), remove "/500.0".
          vEnergy = aData.z; 

          float baseScale = 10.0;

          // Apply Pan & Zoom
          vec2 transformedPos = (pos + uOffset) * (uScale * baseScale);
          
          // Correct for aspect ratio
          transformedPos.x /= uAspect;

          gl_Position = vec4(transformedPos, 0.0, 1.0);

          // Calculate size
          float size = max(1.0, 3.0 * uScale);

          // --- GROW LOGIC ---
          // Check distance between this point and the hovered coordinate
          float dist = distance(pos, uHoverPos);
          vIsHover = step(dist, 0.0001); // 1.0 if hovered, else 0.0

          if (vIsHover > 0.5) {
              size *= 6.0;
          }
          
          // Dynamic point size based on zoom
          gl_PointSize = size;
      }
    `;

export const fs = `
      precision mediump float;
      varying float vEnergy;
      uniform sampler2D uTexture;
      varying float vIsHover;

      void main() {
          if (vIsHover > 0.5) {
            vec4 tex = texture2D(uTexture, gl_PointCoord);
            gl_FragColor = vec4(tex.rgb, 1.0);
            return;
          }

          vec2 uv = gl_PointCoord - 0.5;

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
