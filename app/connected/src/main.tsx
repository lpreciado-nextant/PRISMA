import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ConnectedApp from "./ConnectedApp";
import { initPointerSheen } from "../../src/lib/liquidGlass";

initPointerSheen();
createRoot(document.getElementById("root")!).render(<StrictMode><ConnectedApp /></StrictMode>);