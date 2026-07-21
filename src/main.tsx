import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { syncAuthFromCookies } from "./config/auth";

// Pull tenant + auth token from the parent portal's shared cookies into
// localStorage before anything renders or makes an API call.
syncAuthFromCookies();

createRoot(document.getElementById("root")!).render(<App />);
