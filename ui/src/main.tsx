// Application entry: mount root React tree and global styles.
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./app/styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
  
