// ============================================================================
//  PENDÊNCIAS DO DONO
//  O que está esperando uma decisão humana agora: pré-reservas em análise e
//  conversas que a IA transferiu. Alimenta os selos do menu e o sino do topo.
//
//  O sino também mostra os LEMBRETES DE HOJE: retiradas e devoluções do dia
//  (e devoluções atrasadas), buscados em /api/dashboard/hoje.
//
//  Recarrega a cada troca de tela e a cada 60 segundos.
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';

const INTERVALO_MS = 60_000;

const HOJE_VAZIO = { eventos: [], resumo: { retiradas: 0, devolucoes: 0, atrasadas: 0, total: 0 } };

export default function usePendencias() {
  const [dados, setDados] = useState({ analise: 0, conversas: 0, hoje: HOJE_VAZIO, total: 0 });
  const { pathname } = useLocation();

  const carregar = useCallback(async () => {
    try {
      const [reservas, conversas, hoje] = await Promise.all([
        api.get('/api/reservations?status=em_analise'),
        api.get('/api/conversations?needs_human=true'),
        api.get('/api/dashboard/hoje').catch(() => HOJE_VAZIO),
      ]);
      const analise = reservas?.length || 0;
      const emEspera = conversas?.length || 0;
      const agendaHoje = hoje?.resumo ? hoje : HOJE_VAZIO;
      setDados({
        analise,
        conversas: emEspera,
        hoje: agendaHoje,
        // O sino junta o que precisa de decisão com o que acontece hoje.
        total: analise + emEspera + (agendaHoje.resumo.total || 0),
      });
    } catch {
      // Silencioso de propósito: um selo de contagem nunca deve quebrar a tela.
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar, pathname]);

  return { ...dados, recarregar: carregar };
}
