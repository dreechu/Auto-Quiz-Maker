export type SourceType = "image" | "pdf" | "docx" | "pptx" | "text" | "anki";
export type Difficulty = "easy" | "medium" | "hard";
export type CardStatus = "new" | "learning" | "mastered";
export type CardFormat = "identification" | "enumeration";
export type GenerationFormat = CardFormat | "mixed";
export type ReviewRating = "again" | "hard" | "good" | "easy";

export type Flashcard = {
  question: string;
  answer: string;
  hint: string;
  difficulty: Difficulty;
  status: CardStatus;
  format?: CardFormat;
  nextReviewAt?: number;
  lastReviewedAt?: number;
  intervalDays?: number;
  easeFactor?: number;
  reviewCount?: number;
  lapseCount?: number;
  lastRating?: ReviewRating;
};

export type Deck = {
  title: string;
  description: string;
  sourceType: SourceType;
  cardCount: number;
  masteredCount: number;
  createdAt: number;
  updatedAt: number;
  isPublic?: boolean;
  tags?: string[];
  cards: Record<string, Flashcard>;
};

export type PublicDeckSummary = {
  id: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  description: string;
  sourceType: SourceType;
  cardCount: number;
  createdAt: number;
  updatedAt: number;
};

export function sourceLabel(sourceType: SourceType) {
  const labels: Record<SourceType, string> = {
    image: "Image",
    pdf: "PDF",
    docx: "Word document",
    pptx: "PowerPoint",
    text: "Notes",
    anki: "Anki deck",
  };
  return labels[sourceType];
}
