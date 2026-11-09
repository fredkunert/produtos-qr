# Produtos e QR code — demonstração Centinela

Sistema local para criar produtos fictícios e gerar QR codes que abrem uma ficha web responsiva. Usa Node.js 20+ e a biblioteca `qrcode`; não usa banco, arquivos de dados, localStorage ou serviço externo para gerar QR.

## Executar

```sh
cd produtos-qr
npm install
npm start
```

Acesse **http://localhost:3187**, clique em **Criar produto aleatório** e escaneie o QR. Também é possível abrir a ficha pelo botão ou baixar a etiqueta SVG.

**No celular:** conecte à mesma rede Wi-Fi do computador. O servidor escuta em `0.0.0.0` e o QR usa o primeiro IPv4 externo encontrado. O endereço aparece no terminal e na interface. Se houver VPN ou múltiplas interfaces, defina o IPv4 correto:

```sh
PUBLIC_BASE_URL=http://192.168.1.55:3187 npm start
```

Substitua pelo IP real do computador. Não use `localhost` para escanear pelo celular. A rede precisa permitir comunicação entre dispositivos e o firewall deve permitir a porta escolhida. Para trocar a porta: `PORT=3001 npm start`. Se informar `PUBLIC_BASE_URL`, inclua a mesma porta. O sistema não publica automaticamente na internet.

Os dados ficam **na memória do processo do servidor**, compartilhados entre navegadores e celulares. Recarregar ou fechar a página não apaga produtos. Parar/reiniciar o servidor apaga tudo, e os QR codes anteriores passam a mostrar “Produto indisponível”.

## Modelagem usada

Referências: `../DER-UNIFICADO.pdf` e `../infra-pr10/contratos/produtos.yaml`.

| Entidade do DER | Representação em memória |
| --- | --- |
| FABRICANTES / DISTRIBUIDORES | Maps separados com UUID, tenant, situação e auditoria |
| ITENS | Map com UUID, SKU único, referências aos auxiliares, categoria, descrição, unidade, periodicidade e quantidade mínima |
| PRECIFICACOES | Map por item, garantindo uma precificação por item/tenant |
| PRECIFICACOES_HISTORICO | Snapshot imutável criado junto com o preço |

O gerador respeita os enums do contrato, quantidade mínima positiva, UUIDs, valores monetários com duas casas, desconto entre 0 e 100 e pares tipo/valor nulos em conjunto. A quantidade é exposta como string, conforme `Item`. As entidades usam os campos do DER e a projeção da API usa camelCase conforme o contrato. O tenant e o autor são fictícios, únicos por execução. Preço e mínimo são gerados em centavos; os nomes dos produtos podem se repetir, mas os SKUs não.

Esta é uma demonstração focada no QR: não implementa autenticação, integração com a plataforma, CRUD completo, multi-tenancy real ou toda a API OpenAPI. A listagem retorna todos os itens da sessão (sem paginação). A ficha pública tem projeção própria, com nomes de fabricante/distribuidor e sem custo, mínimo, desconto máximo ou margens. O catálogo administrativo também é aberto nesta demonstração local.

## Rotas

- `GET /`: catálogo e geração de etiquetas.
- `POST /api/mock/itens`: cria produto, preço e snapshot com dados fictícios.
- `GET /api/itens`: itens da sessão.
- `GET /api/itens/:id`: item no formato do contrato.
- `GET /api/itens/:id/qr.svg`: QR real contendo a URL da ficha.
- `GET /api/publico/itens/:id`: projeção pública.
- `GET /produto/:id`: ficha web responsiva.
- `GET /api/config`: endereço usado nos links e QR codes.

## Verificar

```sh
npm test
```

Os testes cobrem relações e regras do mock, criação e consulta por HTTP, decodificação do SVG de QR servido, projeção pública e desaparecimento dos dados em uma nova instância.
