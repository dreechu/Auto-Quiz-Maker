type MultipleChoiceCard = {
  id: string;
  question: string;
  answer: string;
  difficulty?: string;
  format?: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "and", "are", "because",
  "before", "being", "between", "both", "could", "describe", "does", "during",
  "each", "explain", "following", "from", "give", "have", "into", "including",
  "list", "many", "more", "most", "name", "other", "please", "provide",
  "should", "some", "than", "that", "their", "there", "these", "they",
  "this", "those", "through", "under", "using", "what", "when", "where",
  "which", "while", "with", "would",
]);

function getKeywords(text: string) {
  return new Set(
    (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function stableTieBreak(seed: string, candidate: string) {
  let hash = 0;
  for (const character of `${seed}:${candidate}`) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getRelatedDistractors<T extends MultipleChoiceCard>(
  card: T,
  cards: T[],
  limit = 3,
): string[] {
  const keywords = cards.map((item) => getKeywords(item.question));
  const documentFrequency = new Map<string, number>();
  for (const terms of keywords) {
    for (const term of terms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const targetIndex = cards.findIndex((item) => item.id === card.id);
  const targetTerms = keywords[targetIndex] ?? getKeywords(card.question);
  if (!targetTerms.size) return [];

  const weights = new Map(
    [...targetTerms].map((term) => [
      term,
      Math.log(1 + cards.length / (documentFrequency.get(term) ?? 1)),
    ]),
  );
  const targetNorm = Math.sqrt([...weights.values()].reduce((sum, weight) => sum + weight ** 2, 0));
  const correctAnswer = card.answer.trim().toLocaleLowerCase();

  const candidates = cards.flatMap((candidate, index) => {
    const answer = candidate.answer.trim();
    const normalizedAnswer = answer.toLocaleLowerCase();
    if (candidate.id === card.id || !answer || normalizedAnswer === correctAnswer) return [];

    const candidateTerms = keywords[index];
    let dotProduct = 0;
    let candidateNormSquared = 0;
    let sharedTerms = 0;
    for (const term of candidateTerms) {
      const weight = Math.log(1 + cards.length / (documentFrequency.get(term) ?? 1));
      candidateNormSquared += weight ** 2;
      if (weights.has(term)) {
        dotProduct += weight ** 2;
        sharedTerms += 1;
      }
    }
    if (!sharedTerms || !candidateNormSquared) return [];

    let score = dotProduct / (targetNorm * Math.sqrt(candidateNormSquared));
    if (card.format && candidate.format === card.format) score *= 1.05;
    if (card.difficulty && candidate.difficulty === card.difficulty) score *= 1.02;
    return [{ answer, score, tieBreak: stableTieBreak(card.id, candidate.id) }];
  });

  const seenAnswers = new Set<string>();
  const distractors: string[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak)) {
    const normalizedAnswer = candidate.answer.toLocaleLowerCase();
    if (seenAnswers.has(normalizedAnswer)) continue;
    seenAnswers.add(normalizedAnswer);
    distractors.push(candidate.answer);
    if (distractors.length >= limit) break;
  }
  return distractors;
}
