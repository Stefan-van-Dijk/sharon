// Shared, independently editable phrase dictionary for the Cards module.
export const CARD_NAME_QUESTIONS = Object.freeze([
  'Hoe heet deze kaart?',
  'Welke pas wil je bewaren?',
  'Hoe herken jij deze kaart?',
  'Welke kaart voeg je toe?',
  'Van wie is deze pas?'
]);
export function cardNameQuestion(index) {
  return CARD_NAME_QUESTIONS[Math.abs(Number(index) || 0) % CARD_NAME_QUESTIONS.length];
}
