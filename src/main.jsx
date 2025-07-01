import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotificationApp } from "./App.jsx";
import "./main.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <NotificationApp />
  </StrictMode>
);
