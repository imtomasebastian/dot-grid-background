import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/DotGridBackground/index.ts',
    core: 'src/DotGridBackground/vanilla.ts',
  },
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
