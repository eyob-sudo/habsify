import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Ensure Vite resolves react and react-hot-toast to a single copy in the workspace to avoid hook errors
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime') },
      { find: 'react/jsx-dev-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime') },
      // removed react-hot-toast alias (using notyf now)
    ]
  }
})
