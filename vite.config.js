import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMock = env.VITE_USE_MOCK !== 'false' && (!env.VITE_FB_API_KEY || env.VITE_USE_MOCK === 'true');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist'
    },
    resolve: useMock ? {
      alias: {
        'firebase/app': path.resolve(__dirname, 'src/mock/firebase-app.js'),
        'firebase/auth': path.resolve(__dirname, 'src/mock/firebase-auth.js'),
        'firebase/firestore': path.resolve(__dirname, 'src/mock/firebase-firestore.js')
      }
    } : {}
  };
});
