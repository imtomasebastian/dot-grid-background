import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/DotGridBackground/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.app.json',
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  banner: {
    js: "'use client'",
  },
})
