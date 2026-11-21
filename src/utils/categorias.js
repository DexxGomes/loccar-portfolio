// ============================================================================
//  Categorias de veículo aceitas no sistema.
//  São formatos de carroceria (critério único), para não haver ambiguidade:
//  um mesmo carro nunca se encaixa em duas categorias ao mesmo tempo.
//
//  Fonte única da verdade: usada pela validação da API e pelas ferramentas da IA.
//  Para adicionar/remover uma categoria, altere APENAS esta lista
//  (e a lista equivalente do painel, em web/src/pages/Frota.jsx).
// ============================================================================
export const CATEGORIAS = ['hatch', 'sedan', 'SUV', 'picape', 'minivan'];
