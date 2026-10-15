import React from "react";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import AppUpdate from "./components/AppUpdate";
import "./styles.css";
import "./refinement.css";
import "./duo-ui.css";
import "./duo-gate.css";
import "./run.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppUpdate />
    <App />
  </React.StrictMode>,
);
