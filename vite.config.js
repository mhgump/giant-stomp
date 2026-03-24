import { defineConfig } from "vite";

export default defineConfig({
  base: '/giant-stomp/',
  assetsInclude: ["**/*.glb"],
  build: {
    target: 'esnext',
  },
});
