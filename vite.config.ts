import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Aponta o app para o projeto de produção (sobrescreve o .env gerenciado)
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://rqimaoxfnquiygvycklc.supabase.co"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_eSMxI_yecjMZGsfOpboxVA_-fUhPe53"),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("rqimaoxfnquiygvycklc"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },

}));
