export interface DifficultyLevel {
  id: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  name: string;
  /** Rough playing strength, shown as a hint only. */
  elo: number;
  /** Deepest iteration the search may reach. */
  maxDepth: number;
  /** Time budget for one move, in milliseconds. */
  moveTime: number;
  /**
   * Centipawns of random noise added to each root move's score. Non-zero
   * values make the engine score every root move exactly and pick among the
   * noisy scores, which is how the weaker levels make human-like mistakes.
   */
  noise: number;
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { id: 'beginner', name: 'Beginner', elo: 600, maxDepth: 1, moveTime: 300, noise: 250 },
  { id: 'easy', name: 'Easy', elo: 900, maxDepth: 2, moveTime: 500, noise: 120 },
  { id: 'medium', name: 'Medium', elo: 1200, maxDepth: 3, moveTime: 800, noise: 40 },
  { id: 'hard', name: 'Hard', elo: 1500, maxDepth: 5, moveTime: 1500, noise: 0 },
  { id: 'expert', name: 'Expert', elo: 1700, maxDepth: 8, moveTime: 2500, noise: 0 },
  { id: 'master', name: 'Master', elo: 1900, maxDepth: 20, moveTime: 4000, noise: 0 },
];

export const DEFAULT_LEVEL = DIFFICULTY_LEVELS[2];

export const getLevel = (id: string): DifficultyLevel =>
  DIFFICULTY_LEVELS.find((l) => l.id === id) ?? DEFAULT_LEVEL;
