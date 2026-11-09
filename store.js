import { randomUUID, randomInt } from 'node:crypto';

// Entidades separadas conforme DER-UNIFICADO.pdf. Nada é gravado em disco.
export function createStore() {
  const tenantId = randomUUID();
  const autorId = randomUUID();
  const fabricantes = new Map();
  const distribuidores = new Map();
  const itens = new Map();
  const precificacoes = new Map();
  const historico = new Map();
  const audit = () => ({ tenant_id: tenantId, created_at: new Date().toISOString(), created_by: autorId,
    updated_at: new Date().toISOString(), updated_by: autorId, deleted_at: null });
  const auxiliar = (map, nome) => {
    const value = { id: randomUUID(), nome, situacao: 'ATIVO', ...audit() };
    map.set(value.id, value);
    return value.id;
  };
  const fabricanteId = auxiliar(fabricantes, 'Centinela Labs (fictício)');
  const distribuidorId = auxiliar(distribuidores, 'Nuvem Distribuição (fictício)');
  const modelos = [
    ['Proteção de endpoints', 'SEGURANÇA', 'ENDPOINT', 'MENSAL', 'Proteção de dispositivos com monitoramento de ameaças e atualizações automáticas.', 2490],
    ['Backup em nuvem', 'BACKUP', 'GB', 'MENSAL', 'Armazenamento de cópias de segurança com recuperação de arquivos e retenção de 30 dias.', 190],
    ['Consultoria de infraestrutura', 'CONSULTORIA', 'HORA', 'UNICA', 'Avaliação do ambiente de tecnologia e orientação para melhorias de desempenho.', 18000],
    ['Licença de produtividade', 'SOFTWARE', 'LICENCA', 'ANUAL', 'Aplicativos de produtividade, colaboração e comunicação para equipes.', 45900],
    ['Servidor virtual', 'CLOUD', 'VM', 'MENSAL', 'Ambiente virtual para aplicações, com suporte e acompanhamento de disponibilidade.', 28990],
  ];
  function project(item) {
    const price = precificacoes.get(item.id);
    return { id: item.id, sku: item.sku, nome: item.nome, fabricanteId: item.fabricante_id,
      distribuidorId: item.distribuidor_id, categoria: item.categoria, descricao: item.descricao,
      unidade: item.unidade, periodicidade: item.periodicidade, quantidadeMinima: item.quantidade_minima,
      ativo: item.ativo, casasDecimaisQuantidade: ['GB', 'TB', 'HORA'].includes(item.unidade) ? 4 : 0,
      moeda: 'BRL', precoVenda: price?.preco_venda ?? null, precoMinimo: price?.preco_minimo ?? null,
      descontoMaximo: price?.desconto_maximo ?? null, criadoEm: item.created_at, atualizadoEm: item.updated_at };
  }
  function createRandom() {
    const [nome, categoria, unidade, periodicidade, descricao, base] = modelos[randomInt(modelos.length)];
    const id = randomUUID();
    const item = { id, sku: `DEMO-${String(itens.size + 1).padStart(4, '0')}`, nome, categoria, unidade,
      periodicidade, descricao, quantidade_minima: unidade === 'GB' ? '100' : '1', ativo: true,
      fabricante_id: fabricanteId, distribuidor_id: distribuidorId, ...audit() };
    const vendaCentavos = base + randomInt(0, 1000);
    const price = { id: randomUUID(), item_id: id, preco_venda: vendaCentavos / 100,
      preco_minimo: Math.round(vendaCentavos * .9) / 100, desconto_maximo: 10,
      custo: Math.round(vendaCentavos * .6) / 100, markup_valor: null, markup_tipo: null, margem: null,
      impostos_valor: null, impostos_tipo: null, comissao_valor: null, comissao_tipo: null, ...audit() };
    const snapshot = { ...price, id: randomUUID(), precificacao_id: price.id,
      unidade, periodicidade, moeda: 'BRL' };
    itens.set(id, item);
    precificacoes.set(id, price);
    historico.set(snapshot.id, Object.freeze(snapshot));
    return project(item);
  }
  return { tenantId, fabricantes, distribuidores, itens, precificacoes, historico, createRandom,
    list: () => [...itens.values()].reverse().map(project),
    get: id => itens.has(id) ? project(itens.get(id)) : null,
    publicProduct(id) {
      const item = this.get(id);
      if (!item) return null;
      // Projeção pública: não expõe custo, preço mínimo, desconto ou auditoria interna.
      const { precoMinimo, descontoMaximo, ...publicItem } = item;
      return { ...publicItem, fabricante: fabricantes.get(item.fabricanteId)?.nome ?? null,
        distribuidor: distribuidores.get(item.distribuidorId)?.nome ?? null };
    } };
}
