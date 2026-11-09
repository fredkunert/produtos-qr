import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { createApp } from '../server.js';
import { createStore } from '../store.js';

test('mock preserva relações, precisão, SKU e histórico do DER', () => {
  const store = createStore();
  for (let n = 0; n < 50; n++) {
    const item = store.createRandom();
    assert.ok(store.fabricantes.has(item.fabricanteId));
    assert.ok(store.distribuidores.has(item.distribuidorId));
    assert.ok(Number(item.quantidadeMinima) > 0);
    assert.ok(Math.abs(item.precoVenda * 100 - Math.round(item.precoVenda * 100)) < 1e-6);
    assert.ok(item.descontoMaximo >= 0 && item.descontoMaximo <= 100);
    const price = store.precificacoes.get(item.id);
    assert.equal(price.tenant_id, store.tenantId);
    assert.equal(price.markup_valor, null);
    assert.equal(price.markup_tipo, null);
    const snapshot = [...store.historico.values()].find(h => h.item_id === item.id);
    assert.equal(snapshot.precificacao_id, price.id);
    assert.ok(Object.isFrozen(snapshot));
  }
  assert.equal(new Set(store.list().map(p => p.sku.toLowerCase())).size, 50);
  assert.equal(store.precificacoes.size, 50);
  assert.equal(store.historico.size, 50);
  assert.deepEqual(createStore().list(), []);
});

test('criar → consultar em outro cliente → ler QR → reiniciar', async t => {
  const { server } = createApp({ publicBaseUrl: 'http://192.168.1.55:3000' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const creation = await fetch(`${base}/api/mock/itens`, { method: 'POST' });
  assert.equal(creation.status, 201);
  const { data: product } = await creation.json();
  const publicResponse = await fetch(`${base}/api/publico/itens/${product.id}`);
  const { data: publicProduct } = await publicResponse.json();
  assert.equal(publicProduct.id, product.id);
  assert.equal(publicProduct.precoVenda, product.precoVenda);
  assert.equal(publicProduct.custo, undefined);
  assert.equal(publicProduct.precoMinimo, undefined);
  assert.match(publicProduct.fabricante, /fictício/);
  const qrResponse = await fetch(`${base}/api/itens/${product.id}/qr.svg`);
  const svg = await qrResponse.text();
  assert.match(svg, /<svg/);
  // Rasteriza os módulos do SVG servido, decodificando o QR real do endpoint.
  const viewbox = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const size = viewbox * 8;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  const path = svg.match(/stroke="#000000" d="([^"]+)"/)[1];
  let x = 0, y = 0;
  for (const match of path.matchAll(/([Mm])([\d.]+)[ ,]([\d.]+)|h([\d.]+)/g)) {
    if (match[1]) { x = match[1] === 'M' ? +match[2] : x + +match[2]; y = match[1] === 'M' ? +match[3] : y + +match[3]; }
    else {
      const width = +match[4];
      for (let py = Math.round((y - .5) * 8); py < Math.round((y + .5) * 8); py++) {
        for (let px = x * 8; px < (x + width) * 8; px++) {
          const index = (py * size + px) * 4;
          pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
        }
      }
      x += width;
    }
  }
  const decoded = jsQR(pixels, size, size);
  assert.equal(decoded?.data, `http://192.168.1.55:3000/produto/${product.id}`);
  const page = await fetch(`${base}/produto/${product.id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /lang="pt-BR"/);
  assert.equal((await fetch(`${base}/api/publico/itens/inexistente`)).status, 404);
  assert.equal((await fetch(`${base}/api/mock/itens`, { method: 'POST', headers: { Origin: 'http://outro-site.example' } })).status, 403);
  const restarted = createApp();
  assert.equal(restarted.store.get(product.id), null);
});
