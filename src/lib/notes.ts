export type NoteSection = {
  heading: string;
  content: string;
  examples?: string[];
};

export type NoteKeyTerm = {
  term: string;
  definition: string;
};

export type StudyNote = {
  id: string;
  title: string;
  sourceName: string;
  sources?: string[];
  sourceType: string;
  summary: string;
  sections: NoteSection[];
  keyTakeaways: string[];
  keyTerms: NoteKeyTerm[];
  isPublic?: boolean;
  category?: string;
  createdAt: number;
  updatedAt: number;
};

export type PublicNoteSummary = {
  id: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  summary: string;
  sourceType: string;
  sectionCount: number;
  updatedAt: number;
};

export function isValidNoteId(noteId: string): boolean {
  return Boolean(
    noteId &&
    new TextEncoder().encode(noteId).length <= 768 &&
    !/[.#$\[\]/\u0000-\u001F\u007F]/.test(noteId),
  );
}
