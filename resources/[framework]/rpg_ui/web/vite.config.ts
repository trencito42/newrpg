import { defineConfig } from 'vite';

export default defineConfig({
  // FiveM serves NUI files from a resource-scoped URL, so root-relative
  // /assets paths resolve outside the resource and silently fail.
  base: './',
});
