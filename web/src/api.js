// Cliente HTTP simples para o backend. Usa o token JWT do localStorage.
const BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

// ---------------------------------------------------------------------------
//  Sinal de "estou trabalhando"
//
//  Quantas chamadas estão no ar neste momento. A barrinha de carregamento do
//  rodapé escuta isto, então nenhuma tela precisa avisar que está esperando —
//  qualquer ida ao servidor acende a barra sozinha.
// ---------------------------------------------------------------------------
let chamadasNoAr = 0;
const ouvintesDeRede = new Set();

function avisarOuvintes() {
  for (const ouvinte of ouvintesDeRede) ouvinte(chamadasNoAr);
}

/**
 * Observa o tráfego com a API.
 * @param {(chamadasNoAr: number) => void} ouvinte
 * @returns {() => void} função para parar de observar
 */
export function observarRede(ouvinte) {
  ouvintesDeRede.add(ouvinte);
  ouvinte(chamadasNoAr); // já começa sabendo o estado atual
  return () => ouvintesDeRede.delete(ouvinte);
}

async function req(path, opts = {}) {
  chamadasNoAr += 1;
  avisarOuvintes();
  try {
    const token = getToken();
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });

    // Sessão expirada: limpa e volta ao login.
    if (res.status === 401) {
      localStorage.clear();
      if (location.pathname !== '/login') location.href = '/login';
      throw new Error('Sessão expirada.');
    }

    if (!res.ok) {
      const corpo = await res.json().catch(() => ({}));
      const erro = new Error(corpo.error || `Erro ${res.status}`);
      // A API diz QUAIS campos falharam. Levamos isso junto para a tela poder
      // marcar cada campo em vermelho, além de mostrar a frase principal.
      erro.campos = corpo.details || null;
      erro.status = res.status;
      throw erro;
    }
    if (res.status === 204) return null;
    return await res.json();
  } finally {
    chamadasNoAr -= 1;
    avisarOuvintes();
  }
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (p, body) => req(p, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (p) => req(p, { method: 'DELETE' }),
  login: (identificador, senha) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ identificador, senha }) }),
};
