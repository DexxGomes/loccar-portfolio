// ============================================================================
//  PRIMEIROS PASSOS
//  Diz o que já está configurado na locadora e o que falta para o sistema
//  rodar sozinho. Cada passo se marca SOZINHO quando a condição acontece —
//  ninguém precisa clicar em "concluí".
//
//  O guia some da tela quando tudo estiver pronto (deixa de ser útil e vira
//  poluição).
// ============================================================================
import { query } from '../config/db.js';
import { env } from '../config/env.js';

/**
 * @returns {{passos: Array, concluidos: number, total: number, pronto: boolean}}
 */
export async function getPrimeirosPassos(tenant) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM vehicles     WHERE tenant_id = $1) AS veiculos,
       (SELECT COUNT(*)::int FROM reservations WHERE tenant_id = $1) AS reservas,
       (SELECT COUNT(*)::int FROM customers    WHERE tenant_id = $1) AS clientes,
       t.whatsapp_token IS NOT NULL AND t.phone_number_id IS NOT NULL
         AND t.phone_number_id <> ''                                 AS whatsapp,
       (t.legal_name IS NOT NULL AND t.cnpj IS NOT NULL
         AND t.address IS NOT NULL)                                  AS dados_contrato,
       t.owner_alert_phone IS NOT NULL                               AS aviso_dono
     FROM tenants t WHERE t.id = $1`,
    [tenant.id]
  );
  const r = rows[0] || {};

  // A IA depende de uma chave do servidor, não do cadastro da locadora.
  const iaLigada = Boolean(env.ANTHROPIC_API_KEY);

  const passos = [
    {
      id: 'frota',
      titulo: 'Cadastre seus veículos',
      porque: 'Sem carro cadastrado, a IA não tem o que oferecer no WhatsApp.',
      feito: r.veiculos > 0,
      detalhe: r.veiculos > 0 ? `${r.veiculos} veículo(s) na frota` : null,
      para: '/frota',
      acao: 'Cadastrar veículo',
    },
    {
      id: 'dados',
      titulo: 'Complete os dados da locadora',
      porque: 'Razão social, CNPJ e endereço saem impressos no contrato de locação.',
      feito: Boolean(r.dados_contrato),
      para: '/configuracoes',
      acao: 'Preencher dados',
    },
    {
      id: 'whatsapp',
      titulo: 'Conecte o WhatsApp',
      porque: 'É por onde o cliente conversa e a IA faz as pré-reservas.',
      feito: Boolean(r.whatsapp),
      para: '/configuracoes',
      acao: 'Conectar',
    },
    {
      id: 'ia',
      titulo: 'Ligue a inteligência artificial',
      porque: 'É ela que entende o cliente e monta a reserva sozinha.',
      feito: iaLigada,
      para: '/configuracoes',
      acao: 'Ver como',
    },
    {
      id: 'aviso',
      titulo: 'Receba aviso no seu celular',
      porque: 'Quando uma conversa precisar de um humano, o sistema te chama no WhatsApp.',
      feito: Boolean(r.aviso_dono),
      para: '/configuracoes',
      acao: 'Configurar',
      opcional: true,
    },
    {
      id: 'primeira-reserva',
      titulo: 'Receba a primeira reserva',
      porque: 'O teste real: um cliente conversando e a reserva caindo na sua agenda.',
      feito: r.reservas > 0,
      detalhe: r.reservas > 0 ? `${r.reservas} reserva(s) registrada(s)` : null,
      para: '/agenda',
      acao: 'Ver agenda',
    },
  ];

  const obrigatorios = passos.filter((p) => !p.opcional);
  const concluidos = passos.filter((p) => p.feito).length;

  return {
    passos,
    concluidos,
    total: passos.length,
    // "Pronto" olha só o que é obrigatório: o passo opcional não segura o guia.
    pronto: obrigatorios.every((p) => p.feito),
  };
}
