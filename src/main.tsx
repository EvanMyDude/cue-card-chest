import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthGuard } from "./components/AuthGuard";

createRoot(document.getElementById("root")!).render(
  <AuthGuard>
    <App />
  </AuthGuard>
);
