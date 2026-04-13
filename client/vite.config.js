import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// rebuild trigger
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001"
    }
  
});