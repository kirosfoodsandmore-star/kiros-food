import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { mapbox: ["mapbox-gl", "react-map-gl/mapbox"], firebase: ["firebase/app", "firebase/auth", "firebase/firestore"] },
      },
    },
  },
})
