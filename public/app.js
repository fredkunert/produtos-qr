const app = document.querySelector('#app');
const money = value => value == null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const periods = { UNICA: 'Pagamento único', MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual' };
const units = { ENDPOINT: 'endpoint', GB: 'GB', HORA: 'hora', LICENCA: 'licença', VM: 'máquina virtual' };
async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || 'Não foi possível carregar os dados.');
  return body.data;
}
function errorPage(message) {
  app.innerHTML = `<section class="empty standalone"><span class="eyebrow">CONSULTA DO PRODUTO</span><h1>Produto indisponível</h1><p>${escape(message)}</p><a class="button" href="/">Abrir catálogo</a></section>`;
}
function specs(product) {
  const rows = [['SKU', product.sku], ['Categoria', product.categoria], ['Unidade', units[product.unidade] || product.unidade],
    ['Periodicidade', periods[product.periodicidade]], ['Quantidade mínima', new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(product.quantidadeMinima))],
    ['Fabricante', product.fabricante], ['Distribuidor', product.distribuidor]];
  return `<dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value ?? 'Não informado')}</dd></div>`).join('')}</dl>`;
}
async function publicPage(id) {
  try {
    const product = await api(`/api/publico/itens/${encodeURIComponent(id)}`);
    document.title = `${product.nome} | Centinela`;
    app.className = 'public-page';
    app.innerHTML = `<div class="breadcrumb">CATÁLOGO DIGITAL <span>/</span> PRODUTO</div>
      <article class="public-card"><div class="product-heading"><span class="tag">${escape(product.categoria)}</span><span class="status">${product.ativo ? 'Disponível' : 'Inativo'}</span></div>
      <h1>${escape(product.nome)}</h1><p class="description">${escape(product.descricao)}</p>
      <div class="price-block"><span>Preço de venda</span><strong>${money(product.precoVenda)}</strong><p>por ${escape(units[product.unidade] || product.unidade)} · ${escape(periods[product.periodicidade])}</p></div>
      <h2>Informações do produto</h2>${specs(product)}<div class="product-foot">Cadastrado em ${new Date(product.criadoEm).toLocaleString('pt-BR')}<br>Produto demonstrativo. Não disponível para compra.</div></article>
      <p class="session-note">Esta página permanece disponível enquanto o servidor estiver em execução.</p>`;
  } catch (error) { errorPage(error.message); }
}
async function dashboard() {
  let products = [], selected = null, config;
  app.innerHTML = `<div class="page-title"><div><div class="eyebrow">CATÁLOGO & QR CODE</div><h1>Produtos conectados.</h1><p>Crie um produto e leve suas informações para qualquer tela.</p></div><button id="create" class="primary">＋ Criar produto aleatório</button></div>
    <p id="message" role="status" aria-live="polite"></p>
    <div class="workspace"><section class="catalog panel"><div class="section-title"><h2>Produtos desta sessão</h2><span id="count" class="count">0</span></div><div id="list"></div></section>
    <section class="details panel" id="details" aria-label="Produto selecionado"></section></div>
    <aside class="network"><strong>Leia o QR code pelo celular</strong><p>Conecte o celular à mesma rede Wi-Fi deste computador. Os produtos e seus links expiram ao reiniciar o servidor.</p><div>Endereço para acesso: <a id="network-url"></a></div></aside>`;
  const message = document.querySelector('#message');
  const create = document.querySelector('#create');
  const list = document.querySelector('#list');
  const details = document.querySelector('#details');
  function renderList() {
    document.querySelector('#count').textContent = products.length;
    list.innerHTML = products.length ? products.map(p => `<button class="product-row ${p.id === selected ? 'selected' : ''}" data-id="${p.id}" aria-pressed="${p.id === selected}"><span class="product-icon" aria-hidden="true">${escape(p.nome.slice(0, 2).toUpperCase())}</span><span class="row-text"><strong>${escape(p.nome)}</strong><small>${escape(p.sku)} · ${escape(p.categoria)}</small></span><span class="row-price">${money(p.precoVenda)}</span></button>`).join('') : '<div class="empty"><div class="empty-symbol" aria-hidden="true">＋</div><h3>Seu catálogo começa aqui</h3><p>Crie o primeiro produto para gerar sua etiqueta com QR code.</p></div>';
    list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => select(button.dataset.id)));
  }
  async function select(id) {
    selected = id;
    renderList();
    details.innerHTML = '<p role="status">Carregando produto…</p>';
    try {
      const product = await api(`/api/publico/itens/${id}`);
      if (selected !== id) return;
      const url = `${config.publicBaseUrl}/produto/${id}`;
      details.innerHTML = `<div class="section-title"><h2>Etiqueta do produto</h2><span class="tag">Pronta para leitura</span></div>
        <div class="detail-top"><div><small class="sku">${escape(product.sku)}</small><h3>${escape(product.nome)}</h3><p>${escape(product.descricao)}</p><strong class="detail-price">${money(product.precoVenda)}</strong><small class="period">por ${escape(units[product.unidade] || product.unidade)} · ${escape(periods[product.periodicidade])}</small></div>
        <div class="qr"><img src="/api/itens/${id}/qr.svg" width="220" height="220" alt="QR code para consultar ${escape(product.nome)}"><span>Aponte a câmera do celular</span></div></div>
        <div class="actions"><a class="button primary" href="/produto/${id}" target="_blank" rel="noopener">Abrir página do produto</a><a class="button" href="/api/itens/${id}/qr.svg" download="qr-${product.sku}.svg">Baixar QR code</a></div>
        <div class="share"><label for="product-url">Link da etiqueta</label><div><input id="product-url" readonly value="${escape(url)}"><button id="copy" title="Copiar link">Copiar</button></div><span id="copy-status" role="status"></span></div>
        <h3 class="spec-title">Ficha do produto</h3>${specs(product)}`;
      document.querySelector('#copy').addEventListener('click', async () => {
        const status = document.querySelector('#copy-status');
        try {
          if (!navigator.clipboard) throw new Error();
          await navigator.clipboard.writeText(url);
          status.textContent = 'Link copiado.';
        } catch {
          document.querySelector('#product-url').select();
          status.textContent = 'Link selecionado. Use a opção Copiar do seu dispositivo.';
        }
      });
    } catch (error) { if (selected === id) details.textContent = error.message; }
  }
  try {
    const result = await Promise.all([api('/api/config'), api('/api/itens')]);
    config = result[0]; products = result[1].itens;
    const networkUrl = document.querySelector('#network-url');
    networkUrl.textContent = config.publicBaseUrl; networkUrl.href = config.publicBaseUrl;
    renderList();
    if (products.length) await select(products[0].id);
    else details.innerHTML = '<div class="empty awaiting"><div class="qr-outline" aria-hidden="true">▦</div><h2>Uma etiqueta. Todas as informações.</h2><p>O QR code do produto aparecerá aqui, junto com o link da página e sua ficha.</p></div>';
  } catch (error) { message.textContent = `${error.message} Recarregue a página para tentar novamente.`; create.disabled = true; return; }
  create.addEventListener('click', async () => {
    create.disabled = true; create.textContent = 'Criando produto…'; message.textContent = '';
    try {
      const product = await api('/api/mock/itens', { method: 'POST' });
      products.unshift(product);
      await select(product.id);
      message.textContent = `${product.sku} criado. QR code disponível.`;
    } catch (error) { message.textContent = error.message; }
    finally { create.disabled = false; create.textContent = '＋ Criar produto aleatório'; }
  });
}
const match = location.pathname.match(/^\/produto\/([\w-]+)$/);
if (match) publicPage(match[1]); else dashboard();
