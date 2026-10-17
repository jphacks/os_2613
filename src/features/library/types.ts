export type BookEntry = {
  id: string;
  aozoraId: number;
  title: string;
  subtitle: string;
  author: string;
  cardUrl: string;
  htmlUrl: string;
  characters: string;
};
export type SavedBook = BookEntry & { text: string; importedAt: string };
export type SearchResult = { results: BookEntry[]; total: number; page: number };
