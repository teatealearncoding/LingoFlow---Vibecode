
export enum Difficulty {
  AGAIN = 1,
  HARD = 2,
  GOOD = 3,
  EASY = 4
}

export interface Flashcard {
  id: string;
  userId: string; // Ties the card to a specific user identity
  word: string;
  pronunciation: string;
  vietnameseMeaning: string;
  context: string;
  difficulty: 'C1' | 'C2';
  source: string;
  createdAt: number;
  updatedAt: number; // Used to determine the latest version during cross-device sync
  // SRS state
  due: number; // timestamp
  stability: number;
  difficultyRating: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  state: number;
}

export interface ArticleData {
  title: string;
  author: string;
  summary: string;
  url: string;
  words: Flashcard[];
}

export interface User {
  id: string;
  email: string;
  token?: string;
}
