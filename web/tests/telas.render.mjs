// ============================================================================
//  TESTE DE RENDERIZAÇÃO DAS TELAS
//
//  O build do Vite só garante que o código COMPILA. Este teste garante que as
//  telas realmente RENDERIZAM: monta cada uma em memória (react-dom/server) e
//  falha se estourar exceção ou se sair "undefined"/"NaN" na tela.
//
//  Roda sem navegador: as coisas do browser (localStorage, fetch, matchMedia)
//  entram como dublês aqui embaixo.
//
//  Rodar:  npm run test:telas   (dentro de web/)
// ============================================================================
import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SAIDA = path.join(RAIZ, 'node_modules', '.cache-teste-telas.mjs');

// ---------------------------------------------------------------- dublês
const memoria = new Map([
  ['token', 'token-de-teste'],
  ['user', JSON.stringify({ name: 'Dono da Locadora', email: 'dono@teste.com' })],
  ['tenant', JSON.stringify({ id: 't1', name: 'LocCar' })],
  ['tema', 'light'],
]);
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// DOM mínimo: o provedor de tema escreve a classe .dark na raiz do documento
// e ouve a preferência do sistema. Nada disso existe fora do navegador.
const classes = new Set();
globalThis.document = {
  documentElement: {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, v) => (v ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    setAttribute() {},
    style: {},
  },
  body: { style: {} },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = globalThis;
// A tela nunca deve QUEBRAR quando a API não responde — o dublê recusa tudo.
globalThis.fetch = async () => {
  throw new Error('sem rede no teste');
};

// ---------------------------------------------------------------- casos
// Cada caso é uma tela e o texto que PRECISA aparecer nela.
const CASOS = [
  { arquivo: 'src/pages/Hoje.jsx', nome: 'Hoje', esperado: ['Bom dia', 'Boa tarde', 'Boa noite'] },
  { arquivo: 'src/pages/Login.jsx', nome: 'Login', esperado: ['CPF'] },
  { arquivo: 'src/pages/Dinheiro.jsx', nome: 'Dinheiro (resumo)', esperado: ['Dinheiro'] },
  { arquivo: 'src/pages/Analise.jsx', nome: 'Análise', esperado: ['Análise'] },
  { arquivo: 'src/pages/Timeline.jsx', nome: 'Linha do tempo', esperado: ['Linha do tempo'] },
  { arquivo: 'src/components/Layout.jsx', nome: 'Layout (menu + abas)', esperado: ['Hoje', 'Locações', 'Dinheiro', 'Clientes'] },
];

const entrada = `
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TemaProvider } from './src/hooks/useTema.jsx';
import { ToastProvider } from './src/components/Toast.jsx';
import { ConfirmProvider } from './src/components/Modal.jsx';
${CASOS.map((c, i) => `import Tela${i} from './${c.arquivo}';`).join('\n')}

const TELAS = [${CASOS.map((_, i) => `Tela${i}`).join(', ')}];

export function renderizar(indice, rota) {
  return renderToString(
    h(MemoryRouter, { initialEntries: [rota] },
      h(TemaProvider, null,
        h(ToastProvider, null,
          h(ConfirmProvider, null, h(TELAS[indice])))))
  );
}
`;

await build({
  stdin: { contents: entrada, resolveDir: RAIZ, loader: 'jsx' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  outfile: SAIDA,
  logLevel: 'error',
  // Empacota tudo (inclusive React): alguns pacotes de ícones vêm em CJS e
  // fariam require('react') em tempo de execução se React ficasse de fora.
  conditions: ['import', 'module', 'default'],
  // `import.meta.env` é coisa do Vite; fora dele não existe.
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: '', MODE: 'test' }) },
  // Pedaços em CJS (react-dom/server) ainda chamam require('stream'). Damos um
  // require de verdade para o bundle ESM em vez do atalho que só dá erro.
  banner: {
    js: "import { createRequire as __cr } from 'node:module';\nconst require = __cr(import.meta.url);",
  },
});

const { renderizar } = await import(pathToFileURL(SAIDA).href + '?t=' + Date.now());

let falhas = 0;
console.log('=== RENDERIZAÇÃO DAS TELAS ===');

for (const [i, caso] of CASOS.entries()) {
  const rota = caso.nome === 'Login' ? '/login' : '/hoje';
  try {
    const html = renderizar(i, rota);

    const achou = caso.esperado.some((t) => html.includes(t));
    const sujeira = ['undefined', 'NaN', '[object Object]'].filter((s) => html.includes(s));

    if (!achou) {
      console.log(`❌ ${caso.nome} — renderizou, mas não achei nenhum de: ${caso.esperado.join(' / ')}`);
      falhas++;
    } else if (sujeira.length) {
      console.log(`❌ ${caso.nome} — apareceu na tela: ${sujeira.join(', ')}`);
      falhas++;
    } else {
      console.log(`✅ ${caso.nome} — renderizou limpo (${html.length} caracteres)`);
    }
  } catch (e) {
    console.log(`❌ ${caso.nome} — estourou: ${e.message}`);
    falhas++;
  }
}

try {
  rmSync(SAIDA);
} catch {
  /* arquivo temporário */
}

if (falhas) {
  console.log(`\n${falhas} tela(s) com problema.`);
  process.exit(1);
}
console.log('\nTodas as telas renderizam sem quebrar, inclusive com a API fora do ar.');
