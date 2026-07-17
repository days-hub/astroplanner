import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Nothing in public/ ships to production (background art is imported
    // through src/assets and bundled with hashes). Keeping this off also
    // protects the build if large legacy footage is still sitting in
    // public/videos locally.
    copyPublicDir: false,
  },
})
