import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ConnectedApp from "./ConnectedApp";
import { enableRefraction, initPointerSheen } from "../../src/lib/liquidGlass";

enableRefraction();
initPointerSheen();
createRoot(document.getElementById("root")!).render(<StrictMode><ConnectedApp /></StrictMode>);