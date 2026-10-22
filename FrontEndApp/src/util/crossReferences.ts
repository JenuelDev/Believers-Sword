export type CrossReference = {
    id: number;
    to_book: number;
    to_chapter: number;
    to_verse_start: number;
    to_verse_end: number;
    votes: number;
    texts: Array<{ version: string; text: string }>;
};

export type CrossReferenceRequest = {
    book_number: number;
    chapter: number;
    verse: number;
    bible_versions: string[];
    offset?: number;
    limit?: number;
};

export type CrossReferencePage = {
    references: CrossReference[];
    total: number;
    groups: Array<{ book_number: number; count: number }>;
};
