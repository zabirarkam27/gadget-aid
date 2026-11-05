import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../index.css";
import DesignSystemPreview from "./DesignSystemPreview";
import { initializeTheme } from "../utils/theme";

// Separate Vite development entry: not a product route or production build input.
if (import.meta.env.DEV) {
  initializeTheme();
  const root = import.meta.hot?.data.root || createRoot(document.getElementById("root"));
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<BrowserRouter><DesignSystemPreview /></BrowserRouter>);
}
