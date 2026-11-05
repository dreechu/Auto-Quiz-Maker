type MultipleChoiceCard = {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  difficulty?: string;
  format?: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "and", "are", "because",
  "before", "being", "between", "both", "could", "define", "describe", "does",
  "during", "each", "explain", "following", "from", "give", "have", "into",
  "including", "identify", "list", "many", "more", "most", "name", "other",
  "please", "provide", "should", "some", "than", "that", "their", "there",
  "these", "they", "this", "those", "through", "under", "using", "what",
  "when", "where", "which", "while", "with", "would",
]);

function getKeywords(text: string) {
  const words = text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/);
  return new Set(
    words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function getCardTerms(card: MultipleChoiceCard) {
  const terms = new Map<string, number>();
  const fields = [
    { text: card.question, weight: 1 },
    { text: card.answer, weight: 0.7 },
    { text: card.hint ?? "", weight: 0.35 },
  ];

  for (const field of fields) {
    for (const term of getKeywords(field.text)) {
      terms.set(term, Math.max(terms.get(term) ?? 0, field.weight));
    }
  }
  return terms;
}

export function normalizeAnswer(answer: string) {
  return answer
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stableTieBreak(seed: string, candidate: string) {
  let hash = 0;
  for (const character of `${seed}:${candidate}`) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

const MIN_RELEVANCE_SCORE = 0.18;

export function getRelatedDistractors<T extends MultipleChoiceCard>(
  card: T,
  cards: T[],
  limit = 3,
): string[] {
  const cardTerms = cards.map(getCardTerms);
  const documentFrequency = new Map<string, number>();
  for (const terms of cardTerms) {
    for (const term of terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const targetIndex = cards.findIndex((item) => item.id === card.id);
  const targetTerms = cardTerms[targetIndex] ?? getCardTerms(card);
  if (!targetTerms.size) return [];

  const inverseFrequency = (term: string) =>
    Math.log(1 + cards.length / (documentFrequency.get(term) ?? 1));
  const targetWeights = new Map(
    [...targetTerms].map(([term, fieldWeight]) => [
      term,
      inverseFrequency(term) * fieldWeight,
    ]),
  );
  const targetNorm = Math.sqrt(
    [...targetWeights.values()].reduce((sum, weight) => sum + weight ** 2, 0),
  );
  const correctAnswer = normalizeAnswer(card.answer);

  const candidates = cards.flatMap((candidate, index) => {
    const answer = candidate.answer.trim();
    const normalizedAnswer = normalizeAnswer(answer);
    if (candidate.id === card.id || !answer || normalizedAnswer === correctAnswer) return [];

    const candidateTerms = cardTerms[index];
    let dotProduct = 0;
    let candidateNormSquared = 0;
    let sharedTerms = 0;
    let hasDistinctiveSharedTerm = false;
    for (const [term, fieldWeight] of candidateTerms) {
      const weight = inverseFrequency(term) * fieldWeight;
      candidateNormSquared += weight ** 2;
      const targetWeight = targetWeights.get(term);
      if (targetWeight !== undefined) {
        dotProduct += targetWeight * weight;
        sharedTerms += 1;
        if (
          term.length >= 6 &&
          (documentFrequency.get(term) ?? 0) <= Math.max(2, Math.floor(cards.length * 0.12))
        ) {
          hasDistinctiveSharedTerm = true;
        }
      }
    }
    if (sharedTerms < 2 && !hasDistinctiveSharedTerm) return [];
    if (!candidateNormSquared) return [];

    let score = dotProduct / (targetNorm * Math.sqrt(candidateNormSquared));
    if (score < MIN_RELEVANCE_SCORE) return [];
    if (card.format && candidate.format === card.format) score *= 1.05;
    if (card.difficulty && candidate.difficulty === card.difficulty) score *= 1.02;
    return [{ answer, score, tieBreak: stableTieBreak(card.id, candidate.id) }];
  });

  const seenAnswers = new Set<string>();
  const distractors: string[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak)) {
    const normalizedAnswer = normalizeAnswer(candidate.answer);
    if (seenAnswers.has(normalizedAnswer)) continue;
    seenAnswers.add(normalizedAnswer);
    distractors.push(candidate.answer);
    if (distractors.length >= limit) break;
  }
  return distractors;
}
