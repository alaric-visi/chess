import { Square as ChessSquare, PieceSymbol, Color } from 'chess.js';

export type PieceType = PieceSymbol;
export type PieceColor = Color;

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

export interface GameState {
  fen: string;
  selectedSquare: ChessSquare | null;
  validMoves: ChessSquare[];
  lastMove: { from: ChessSquare; to: ChessSquare } | null;
  isThinking: boolean;
  gameOver: boolean;
  result: string | null;
  turn: PieceColor;
}

export interface DifficultyLevel {
  name: string;
  skillLevel: number; // Stockfish skill level 0-20
  elo: number;
  depth: number;
  moveTime: number; // milliseconds
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { name: 'Beginner', skillLevel: 1, elo: 800, depth: 5, moveTime: 500 },
  { name: 'Easy', skillLevel: 5, elo: 1200, depth: 8, moveTime: 750 },
  { name: 'Medium', skillLevel: 10, elo: 1600, depth: 12, moveTime: 1000 },
  { name: 'Hard', skillLevel: 15, elo: 2000, depth: 15, moveTime: 1500 },
  { name: 'Expert', skillLevel: 18, elo: 2400, depth: 18, moveTime: 2000 },
  { name: 'Master', skillLevel: 20, elo: 2800, depth: 20, moveTime: 3000 },
];

export const SQUARES: ChessSquare[] = [
  'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
  'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
  'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
  'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
  'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
  'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
  'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
  'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
];

export const getSquarePosition = (square: ChessSquare): { row: number; col: number } => {
  const col = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const row = parseInt(square[1]) - 1; // 1=0, 2=1, etc.
  return { row, col };
};

export const getSquareFromPosition = (row: number, col: number): ChessSquare => {
  const file = String.fromCharCode(97 + col);
  const rank = (row + 1).toString();
  return `${file}${rank}` as ChessSquare;
};
