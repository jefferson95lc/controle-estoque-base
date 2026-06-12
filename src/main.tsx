import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Limpa sessões antigas quando o projeto Supabase muda (evita ficar logado em base errada)
try {
  const currentRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
  const STORAGE_FLAG = "sb-active-project-ref";
  const stored = localStorage.getItem(STORAGE_FLAG);
  if (stored !== currentRef) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(STORAGE_FLAG, currentRef);
  }
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
