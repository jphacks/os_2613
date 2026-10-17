// 本棚に並ぶ本の一覧。教材のPDFは公式配布物を無改変で同梱している。
// 出典と利用条件は assets/books/oej/出典.md と、読書画面に表示する。

export type BookKind = 'novel' | 'study';

export type Book = {
  id: string;
  title: string;
  author: string;
  kind: BookKind;
  pages?: number;
  source?: string;
  license?: string;
};

export const books: Book[] = [
  { id: 'sample', title: '走れメロス', author: '太宰 治', kind: 'novel' },
  {
    id: 'calculus',
    title: '微分積分学',
    author: '吉田 伸生',
    kind: 'study',
    pages: 227,
    source: 'https://ocw.kyoto-u.ac.jp/course/547/',
    license: '京都大学OCW・CC BY-NC-SA',
  },
  {
    id: 'thermodynamics',
    title: '熱力学',
    author: '冨田 博之',
    kind: 'study',
    pages: 98,
    source: 'https://ocw.kyoto-u.ac.jp/course/815/',
    license: '京都大学OCW・CC BY-NC-SA',
  },
  {
    id: 'mathematics-for-economics',
    title: '経済学のための数学',
    author: '原 千秋',
    kind: 'study',
    pages: 68,
    source: 'https://ocw.kyoto-u.ac.jp/course/663/',
    license: '京都大学OCW・CC BY-NC-SA',
  },
  {
    id: 'ai-for-teachers',
    title: '教師のためのAI入門',
    author: 'Colin de la Higuera・Jotsna Iyer（名古屋大学 訳）',
    kind: 'study',
    pages: 355,
    source: 'https://yamazato.nuee.nagoya-u.ac.jp/research/OER/AI_for_Teachers_an_Open_Textbook/',
    license: 'CC BY 4.0',
  },
];

export const findBook = (id: string) => books.find(book => book.id === id);
