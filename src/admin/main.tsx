import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/tokens.css";
import "./styles.css";
import { App } from "./App";
import { ToastProvider } from "./hooks";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
