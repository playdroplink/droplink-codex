import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // Try to use HTTPS in development if certificates exist
  let httpsConfig: any = false;
  
  if (mode === 'development') {
    try {
      // Check if certificates exist (you can create self-signed ones)
      const keyPath = path.resolve(__dirname, 'dev-certs/key.pem');
      const certPath = path.resolve(__dirname, 'dev-certs/cert.pem');
      
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        httpsConfig = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
        console.log('🔒 Using HTTPS for Pi SDK compatibility');
      } else {
        console.log('⚠️ HTTPS certificates not found. Pi SDK may have CORS issues.');
        console.log('Run: npm run setup:https to create development certificates');
      }
    } catch (error) {
      console.log('⚠️ Could not setup HTTPS for development');
    }
  }

  const plugins = [react()];

  if (mode === 'development') {
    try {
      const { componentTagger } = await import("lovable-tagger");
      plugins.push(componentTagger());
    } catch (error) {
      console.log('Could not load development component tagger');
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      strictPort: false,
      https: httpsConfig,
      cors: {
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['*']
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': '*',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      },
      proxy: {
        '/pi-sdk': {
          target: 'https://sdk.minepi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/pi-sdk/, ''),
          secure: false,
          headers: {
            'Origin': 'https://sdk.minepi.com'
          }
        }
      },
      middlewareMode: false,
    },
    publicDir: 'public',
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      global: 'globalThis',
    }
  };
});
