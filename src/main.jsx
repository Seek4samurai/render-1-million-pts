import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Mesh from "./Mesh.jsx";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <div className="w-screen h-screen">
      <Mesh />
    </div>
  </StrictMode>,
);

