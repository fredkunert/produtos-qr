import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { createStore } from './store.js';

const staticFiles = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'],
  '/styles.css': ['styles.css', 'text/css'] };
export function localAddress() {
  return Object.values(networkInterfaces()).flat().find(a => a.family === 'IPv4' && !a.internal)?.address ?? 'localhost';
}
export function createApp({ store = createStore(), publicBaseUrl } = {}) {
  if (publicBaseUrl && !/^https?:\/\//.test(publicBaseUrl)) throw new Error('PUBLIC_BASE_URL deve iniciar com http:// ou https://');
  const server = http.createServer(async (req, res) => {
    const reply = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    const ok = data => ({ success: true, data, message: null, errors: [] });
    const fail = (status, message) => reply(status, { success: false, data: null, message,
      errors: [{ campo: 'requisicao', codigo: status === 404 ? 'NAO_ENCONTRADO' : 'REQUISICAO_INVALIDA', detalhe: message }] });
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const base = (publicBaseUrl || `http://${localAddress()}:${server.address().port}`).replace(/\/$/, '');
      if (req.method === 'GET' && pathname === '/api/config') return reply(200, ok({ publicBaseUrl: base }));
      if (req.method === 'GET' && pathname === '/api/itens') return reply(200, ok({ itens: store.list(), pagina: 0, tamanho: store.itens.size, total: store.itens.size }));
      if (req.method === 'POST' && pathname === '/api/mock/itens') {
        // Rejeita criação cross-origin acidental; demonstração local sem autenticação.
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return fail(403, 'Origem não permitida.');
        return reply(201, ok(store.createRandom()));
      }
      const match = pathname.match(/^\/api\/(itens|publico\/itens)\/([\w-]+)(\/qr.svg)?$/);
      if (req.method === 'GET' && match) {
        const [, scope, id, qr] = match;
        const product = scope === 'itens' ? store.get(id) : store.publicProduct(id);
        if (!product) return fail(404, 'Produto não encontrado. Os dados podem ter expirado após reiniciar o sistema.');
        if (qr) return reply(200, await QRCode.toString(`${base}/produto/${id}`, { type: 'svg', width: 320, margin: 4, errorCorrectionLevel: 'M' }), 'image/svg+xml');
        return reply(200, ok(product));
      }
      const file = /^\/produto\/[\w-]+$/.test(pathname) ? staticFiles['/'] : staticFiles[pathname];
      if (req.method === 'GET' && file) return reply(200, await readFile(new URL(`./public/${file[0]}`, import.meta.url)), file[1]);
      return fail(404, 'Página não encontrada.');
    } catch (error) {
      console.error(error);
      return fail(500, 'Não foi possível concluir a operação.');
    }
  });
  return { server, store };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3187);
  const { server } = createApp({ publicBaseUrl: process.env.PUBLIC_BASE_URL });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Catálogo: http://localhost:${port}\nCelular na mesma rede: ${process.env.PUBLIC_BASE_URL || `http://${localAddress()}:${port}`}\nDados somente em memória; reiniciar apaga todos os produtos.`);
  });
}
