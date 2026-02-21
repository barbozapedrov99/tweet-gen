# Guia técnico — suporte a Carrossel do Instagram

## Objetivo
Adicionar no gerador atual a capacidade de criar **carrossel** (múltiplas páginas/slides), mantendo o mesmo padrão visual já usado no post único (card 1080x1440 em estilo Tweet).

## Viabilidade
É totalmente viável com a arquitetura atual. O projeto já possui:
- um modelo de dados central (`TweetData`) para o card;
- um componente de renderização isolado (`TweetCard`);
- exportação de imagem baseada no elemento de preview (`html-to-image`).

Esses três pontos permitem evoluir de “1 card” para “N cards”, sem reescrever toda a UI.

---

## Como implementar (passo a passo)

### 1) Evoluir o modelo para múltiplos slides
Hoje o estado principal guarda apenas um `tweetData`. O ideal é migrar para:

- `slides: TweetData[]`
- `activeSlideIndex: number`

Estratégia prática:
1. Criar um novo tipo `CarouselData` (ou manter no estado do `App`):
   - `slides`
   - `activeSlideIndex`
2. Adaptar handlers (`handleInputChange`, upload, IA, drag/resize) para alterar **somente o slide ativo**.
3. Reaproveitar quase tudo de `TweetData`, pois o layout de cada página é o mesmo.

> Dica: começar com “slide 1” criado a partir de `DEFAULT_TWEET_DATA`.

### 2) Barra de páginas (UX de carrossel)
Adicionar no editor:
- botão **+ Novo slide**;
- lista de miniaturas (ou botões numerados: 1, 2, 3...);
- ações por slide: duplicar, remover, reordenar.

Fluxo recomendado:
- clique no slide N -> carrega no preview e nos inputs;
- alterações no formulário afetam apenas o N.

### 3) Histórico Undo/Redo por slide (ou global)
Você tem histórico global de `TweetData`. Com carrossel, há duas opções:
- **simples**: histórico global do objeto inteiro (`slides + activeSlideIndex`);
- **avançado**: histórico por slide.

Comece pelo global (implementação menor, previsível).

### 4) Exportação para carrossel
Instagram usa carrossel com múltiplas imagens. Você já exporta 1 JPEG; para carrossel, faça:

- botão **Exportar carrossel**;
- laço pelos slides:
  1. renderizar temporariamente o slide i no `previewRef`;
  2. gerar data URL com `html-to-image`;
  3. baixar com nome sequencial (`carrossel-01.jpg`, `carrossel-02.jpg`...).

Opcional melhor UX:
- gerar um `.zip` com todas as páginas (ex.: JSZip + file-saver).

### 5) IA por slide
A geração/edição de mídia com Gemini pode continuar igual, mas aplicada ao slide ativo.

Sugestão:
- campo de prompt por slide (ou global com botão “aplicar no slide atual”).

### 6) Limites e validações
Para evitar complexidade inicial:
- limitar entre 2 e 10 slides;
- bloquear exclusão quando só houver 1 slide;
- exibir contador (“Slide 3 de 7”).

### 7) Presets para carrossel
Depois da versão inicial, você pode incluir modelos rápidos:
- capa (slide 1);
- conteúdo (slides do meio);
- CTA final.

Isso aumenta muito a qualidade sem exigir IA.

---

## Estratégia de rollout (baixo risco)

### Fase 1 (MVP)
- `slides[]` + seleção de slide;
- edição do slide ativo;
- exportação em lote de JPG sequencial.

### Fase 2
- duplicar/reordenar slide;
- zip único;
- UX refinada (miniaturas).

### Fase 3
- templates de carrossel;
- IA para gerar sequência textual dos slides.

---

## Impacto esperado no código
- **Baixo a médio** no `App.tsx` (estado e handlers);
- **Baixo** no `TweetCard.tsx` (provavelmente quase zero, ele já renderiza 1 card muito bem);
- **Baixo** em `types.ts` e `constants.ts` (novos tipos/defaults auxiliares).

---

## Conclusão
Sim, o produto atual já está bem posicionado para suportar carrossel no mesmo formato visual.

A melhor abordagem é transformar o estado de “card único” para “lista de cards”, mantendo o `TweetCard` como unidade de renderização e reaproveitando a exportação para gerar múltiplos arquivos.
