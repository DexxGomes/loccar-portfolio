// ============================================================================
//  AUDITORIA — registra quem acessou dado pessoal de quem
//
//  Vale a pena entender a regra por trás das escolhas aqui:
//
//  1. Registra DEPOIS da resposta, e só se deu certo (2xx). Tentativa que
//     falhou não é acesso a dado — e registrar 404 encheria a tabela com o
//     ruído de quem digitou um link errado.
//
//  2. NUNCA guarda a query string. A busca do painel manda CPF e telefone em
//     ?search=, e um registro de auditoria que guarda o dado que ele deveria
//     proteger é um segundo vazamento.
//
//  3. Não trava a requisição. Se a gravação falhar, o usuário não pode ficar
//     sem resposta por causa do log — o erro vai para o console e a vida
//     segue. Auditoria é importante, mas não mais do que o sistema funcionar.
// ============================================================================
import { registrarAcesso } from '../repositories/auditRepository.js';

/**
 * Nomes em português para o que aconteceu — este registro vai ser lido por
 * gente (o dono, um advogado, talvez a ANPD), não por máquina.
 */
function descrever(req) {
  const p = req.path;
  const m = req.method;

  if (/^\/[^/]+\/data$/.test(p) && m === 'DELETE') return 'apagou dados do cliente (LGPD)';
  if (/^\/[^/]+\/documents$/.test(p)) return 'viu os documentos';
  if (/^\/[^/]+\/messages$/.test(p)) return 'leu a conversa';
  if (/^\/[^/]+\/contrato$/.test(p)) return 'abriu o contrato';
  if (/^\/[^/]+\/reservations$/.test(p)) return 'viu o histórico de locações';
  if (/^\/[^/]+$/.test(p) && m === 'GET') return 'abriu a ficha';
  if (/^\/[^/]+$/.test(p) && m === 'PATCH') return 'alterou o cadastro';
  if (m === 'GET') return 'consultou';
  return m.toLowerCase();
}

/** O id do registro acessado, quando a rota fala de um só. */
function idDoRecurso(req) {
  const id = req.params?.id;
  return /^[0-9a-f-]{36}$/i.test(id || '') ? id : null;
}

/**
 * @param {string} recurso nome do que está sendo acessado ('customer'...)
 */
export function auditar(recurso) {
  return (req, res, next) => {
    // 'finish' dispara quando a resposta foi enviada: já sabemos o status, e
    // o cliente não espera pela gravação.
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      if (!req.tenant?.id) return;

      registrarAcesso({
        tenantId: req.tenant.id,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        acao: descrever(req),
        recurso,
        recursoId: idDoRecurso(req),
        ip: req.ip,
      }).catch((err) => console.error('Falha ao registrar auditoria:', err.message));
    });

    next();
  };
}
