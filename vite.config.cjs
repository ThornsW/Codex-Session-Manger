const react = require("@vitejs/plugin-react");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "jsdom",
    setupFiles: []
  }
});
