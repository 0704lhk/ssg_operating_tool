import { defineConfig } from 'vite';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const blockedFolders = ['A_매출비교', 'B_팝업오픈', 'C_행사준비', 'D_화면과연결', 'E_짧은연습', 'outputs', 'results', '.git'];
export default defineConfig({
  publicDir: false,
  plugins: [{
    name: 'local-private-files',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let route;
        try { route = decodeURIComponent(request.url.split('?')[0]).replace(/\\/g, '/'); }
        catch { response.statusCode = 400; response.end('Bad request'); return; }
        const parts = route.split('/');
        if (parts.some(part => blockedFolders.includes(part) || part.startsWith('.env'))) {
          response.statusCode = 403;
          response.end('Private local file');
          return;
        }
        next();
      });
    },
  }],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: blockedFolders.map(folder => `**/${folder}/**`) },
    fs: {
      strict: true,
      deny: ['.env', '.env.*', ...blockedFolders.map(folder => `**/${folder}/**`), '**/*.pem', '**/*.key'],
    },
  },
  build: {
    outDir: `outputs/build-${stamp}`,
    emptyOutDir: false,
  },
});
