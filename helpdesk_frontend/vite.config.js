import { defineConfig } from 'vite'

// Vite 8 usa Rolldown/OXC como motor padrão.
// @vitejs/plugin-react (Babel) não é compatível com Vite 8.
// Solução: configurar o JSX diretamente nas opções do OXC.
export default defineConfig({
  // OXC transforma JSX automaticamente para .jsx e .tsx
  oxc: {
    jsxRuntime: 'automatic',
  },
  // Fallback para ambientes que ainda usam esbuild
  esbuild: {
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
