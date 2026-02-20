
import { Flashcard, Difficulty } from '../types';

export const initializeCard = (word: any, source: string, userId: string): Flashcard => {
  const now = Date.now();
  return {
    ...word,
    id: Math.random().toString(36).substr(2, 9),
    userId,
    source,
    createdAt: now,
    updatedAt: now,
    due: now,
    stability: 0,
    difficultyRating: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    state: 0, // 0: New, 1: Learning, 2: Review, 3: Relearning
  };
};

export const scheduleReview = (card: Flashcard, rating: Difficulty): Flashcard => {
  const newCard = { ...card };
  newCard.reps += 1;
  newCard.updatedAt = Date.now(); // Update timestamp every time a review happens
  
  let days = 1;
  if (rating === Difficulty.AGAIN) {
    days = 0;
    newCard.state = 3;
  } else if (rating === Difficulty.HARD) {
    days = Math.max(1, card.scheduledDays * 1.2);
    newCard.state = 2;
  } else if (rating === Difficulty.GOOD) {
    days = Math.max(1, (card.scheduledDays || 1) * 2.5);
    newCard.state = 2;
  } else if (rating === Difficulty.EASY) {
    days = Math.max(1, (card.scheduledDays || 1) * 4);
    newCard.state = 2;
  }

  newCard.scheduledDays = Math.round(days);
  newCard.due = Date.now() + newCard.scheduledDays * 24 * 60 * 60 * 1000;
  
  return newCard;
};
