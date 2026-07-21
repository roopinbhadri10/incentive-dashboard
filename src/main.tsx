import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { syncAuthFromCookies } from "./config/auth";

// Pull tenant + auth token from the parent portal's shared cookies into
// localStorage before anything renders or makes an API call.
syncAuthFromCookies();

// Dev-only fallbacks so the app works standalone (no parent portal / cookies).
// When embedded, the cookies win and this block is skipped. Update the token /
// tenant below for local development.
if (!localStorage.getItem("authToken")) {
  localStorage.setItem(
    "authToken",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODQ2NDE3MzAsImV4cCI6MTc4NDY3NzczMCwidGVuYW50X2lkIjoiRW1hbWkiLCJ1c2VyX2lkIjozMjk3NzcwLCJ1c2VybmFtZSI6IkVtYW1pIiwib3JnX3R5cGUiOm51bGwsIm9yZ19jb2RlIjpudWxsLCJkZWZhdWx0X2NyZWRzIjp0cnVlLCJyb2xlcyI6WyJURU5BTlRfQURNSU4iXSwianRpIjoiNDRkYzlhMjYtOTgwNy00YTM1LTkzN2YtODIwZDgyYzQ4MTM0In0.PoWEx_JjzM-Pw07C2NCtUcmoxan6IWl8TV9uqK2G4go",
  );
}
if (!localStorage.getItem("accountId")) {
  localStorage.setItem("accountId", "Emami");
}

createRoot(document.getElementById("root")!).render(<App />);
