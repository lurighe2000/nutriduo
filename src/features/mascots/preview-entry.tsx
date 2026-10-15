import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import MascotPreview from "./MascotPreview";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MascotPreview />
  </React.StrictMode>,
);
