import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({

  plugins: [react()],

  base: "/migracio-terkep/",

  build: {

    outDir: "dist",

    assetsDir: "assets",

    sourcemap: false

  },

  server: {

    host: true,

    port: 5173

  }

});
