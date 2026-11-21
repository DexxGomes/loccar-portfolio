// ============================================================================
//  Erro de aplicação com código HTTP.
//  Serviços lançam HttpError(404, 'Não encontrado') e o errorHandler central
//  transforma isso na resposta correta ao cliente da API.
// ============================================================================
export class HttpError extends Error {
  /**
   * @param {number} status  código HTTP (ex: 400, 404, 409)
   * @param {string} message mensagem para o cliente da API
   * @param {*} [details]     detalhes opcionais (ex: campos inválidos)
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}
