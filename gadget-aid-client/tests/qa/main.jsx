import { createRoot } from "react-dom/client";
import QA from "./App";
import { initializeTheme } from "../../src/utils/theme";
initializeTheme();
const root = import.meta.hot?.data.root || createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<QA />);
