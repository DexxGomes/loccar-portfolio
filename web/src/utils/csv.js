// ============================================================================
//  Leitura de planilhas CSV no navegador (sem dependência externa).
//
//  Lida com o que aparece de verdade em export de Excel/Google Sheets em pt-BR:
//    - separador vírgula (,) OU ponto e vírgula (;) — detecta sozinho
//    - campos entre aspas com vírgula/ quebra de linha dentro
//    - aspas duplas escapadas ("")
//    - BOM no começo do arquivo
// ============================================================================

/** Detecta o separador olhando a primeira linha (vírgula x ponto e vírgula). */
function detectarSeparador(texto) {
  const primeiraLinha = texto.slice(0, texto.indexOf('\n') + 1 || texto.length);
  const virgulas = (primeiraLinha.match(/,/g) || []).length;
  const pontoEVirgula = (primeiraLinha.match(/;/g) || []).length;
  return pontoEVirgula > virgulas ? ';' : ',';
}

/**
 * Faz o parse de um texto CSV em uma matriz de linhas (cada linha = array de
 * células). Ignora linhas totalmente vazias.
 */
export function parseCSV(textoBruto) {
  // Remove BOM e normaliza quebras de linha.
  const texto = textoBruto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = detectarSeparador(texto);

  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1; // aspas escapada ("")
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroDeAspas = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  // Último campo/linha (arquivo sem quebra final).
  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas
    .map((l) => l.map((c) => c.trim()))
    .filter((l) => l.some((c) => c !== ''));
}

// Sinônimos de cabeçalho aceitos para cada campo de lead (tudo em minúsculo,
// sem acento). Assim a planilha do cliente não precisa ter nomes exatos.
const SINONIMOS = {
  name: ['nome', 'name', 'cliente', 'contato', 'lead'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'],
  email: ['email', 'e-mail'],
  source: ['origem', 'source', 'fonte', 'canal'],
  estimated_value: ['valor', 'valor estimado', 'estimated_value', 'ticket'],
  notes: ['observacao', 'observacoes', 'notes', 'obs', 'anotacao', 'anotacoes', 'nota'],
};

/** Tira acento e baixa a caixa, pra casar cabeçalhos "Telefone" ~ "telefone". */
function normalizar(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * A partir da matriz de linhas, tenta casar as colunas com os campos de lead.
 * Retorna { headers, mapa } onde mapa[campo] = índice da coluna (ou -1).
 */
export function mapearColunas(linhas) {
  const headers = (linhas[0] || []).map(normalizar);
  const mapa = {};
  for (const campo of Object.keys(SINONIMOS)) {
    mapa[campo] = headers.findIndex((h) => SINONIMOS[campo].includes(h));
  }
  return { headers: linhas[0] || [], mapa };
}

/** Converte um valor tipo "R$ 1.200,50" em número 1200.5 (ou undefined). */
function valorParaNumero(v) {
  if (!v) return undefined;
  const limpo = String(v)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // tira separador de milhar
    .replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Transforma as linhas (menos o cabeçalho) em objetos de lead prontos para a
 * API, usando o mapa de colunas. Descarta linhas sem nome.
 */
export function linhasParaLeads(linhas, mapa) {
  const corpo = linhas.slice(1);
  const pega = (linha, campo) => (mapa[campo] >= 0 ? linha[mapa[campo]] : undefined);

  return corpo
    .map((linha) => {
      const lead = {
        name: pega(linha, 'name'),
        phone: pega(linha, 'phone'),
        email: pega(linha, 'email'),
        source: pega(linha, 'source') || 'Planilha',
        notes: pega(linha, 'notes'),
      };
      const valor = valorParaNumero(pega(linha, 'estimated_value'));
      if (valor !== undefined) lead.estimated_value = valor;
      // Remove campos vazios pra não enviar "" à API.
      for (const k of Object.keys(lead)) {
        if (lead[k] == null || lead[k] === '') delete lead[k];
      }
      return lead;
    })
    .filter((l) => l.name);
}
