import { useState, useCallback, useRef } from 'react';
import { DifficultyLevel, DIFFICULTY_LEVELS } from '../../types/chess/chess';
import { Chess, Move, Square } from 'chess.js';

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables for positional evaluation
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLE_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

const getPieceSquareValue = (piece: string, square: Square, isWhite: boolean): number => {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const index = isWhite ? (7 - rank) * 8 + file : rank * 8 + file;

  switch (piece.toLowerCase()) {
    case 'p': return PAWN_TABLE[index];
    case 'n': return KNIGHT_TABLE[index];
    case 'b': return BISHOP_TABLE[index];
    case 'r': return ROOK_TABLE[index];
    case 'q': return QUEEN_TABLE[index];
    case 'k': return KING_MIDDLE_TABLE[index];
    default: return 0;
  }
};

// Evaluate the board position
const evaluateBoard = (game: Chess): number => {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -100000 : 100000;
  }
  if (game.isDraw() || game.isStalemate()) {
    return 0;
  }

  let score = 0;
  const board = game.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const square = (String.fromCharCode(97 + col) + (8 - row)) as Square;
        const pieceValue = PIECE_VALUES[piece.type];
        const positionValue = getPieceSquareValue(piece.type, square, piece.color === 'w');
        const totalValue = pieceValue + positionValue;
        
        score += piece.color === 'w' ? totalValue : -totalValue;
      }
    }
  }

  // Mobility bonus
  const currentTurn = game.turn();
  const mobility = game.moves().length;
  score += currentTurn === 'w' ? mobility * 2 : -mobility * 2;

  return score;
};

// Order moves for better alpha-beta pruning
const orderMoves = (game: Chess, moves: Move[]): Move[] => {
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Captures first (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
    if (a.captured) {
      scoreA += PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece];
    }
    if (b.captured) {
      scoreB += PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece];
    }

    // Promotions
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion];

    // Checks (need to test)
    if (a.san.includes('+')) scoreA += 50;
    if (b.san.includes('+')) scoreB += 50;

    return scoreB - scoreA;
  });
};

// Minimax with alpha-beta pruning
const minimax = (
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number => {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = orderMoves(game, game.moves({ verbose: true }));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

// Get the best move using minimax
const getBestMoveWithMinimax = (fen: string, depth: number): string | null => {
  try {
    const game = new Chess(fen);
    const moves = orderMoves(game, game.moves({ verbose: true }));

    if (moves.length === 0) return null;

    const isMaximizing = game.turn() === 'w';
    let bestMove: Move | null = null;
    let bestValue = isMaximizing ? -Infinity : Infinity;

    for (const move of moves) {
      game.move(move);
      const value = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
      game.undo();

      if (isMaximizing ? value > bestValue : value < bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }

    if (bestMove) {
      return bestMove.from + bestMove.to + (bestMove.promotion || '');
    }
    return null;
  } catch (e) {
    console.error('Minimax error:', e);
    return null;
  }
};

// Simple random move with basic heuristics for lower difficulties
const getSimpleAIMove = (fen: string, difficulty: DifficultyLevel): string | null => {
  try {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });

    if (moves.length === 0) return null;

    // Add randomness based on difficulty
    const scoredMoves = moves.map((move) => {
      let score = Math.random() * 5;

      // Captures
      if (move.captured) {
        score += PIECE_VALUES[move.captured] / 10;
      }

      // Center control
      if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
        score += 3;
      }

      // Development
      if (['n', 'b'].includes(move.piece) && ['1', '8'].includes(move.from[1])) {
        score += 4;
      }

      // Check
      if (move.san.includes('+')) {
        score += 8;
      }

      // Checkmate detection
      const testGame = new Chess(fen);
      testGame.move(move);
      if (testGame.isCheckmate()) {
        score += 10000;
      }

      return { move, score };
    });

    // Higher difficulty = less randomness in selection
    const difficultyFactor = difficulty.skillLevel / 20;
    scoredMoves.forEach(m => {
      m.score = m.score * difficultyFactor + Math.random() * (1 - difficultyFactor) * 20;
    });

    scoredMoves.sort((a, b) => b.score - a.score);
    
    // Pick from top moves based on difficulty
    const topCount = Math.max(1, Math.ceil(5 * (1 - difficultyFactor)));
    const topMoves = scoredMoves.slice(0, topCount);
    const selected = topMoves[Math.floor(Math.random() * topMoves.length)];

    return selected.move.from + selected.move.to + (selected.move.promotion || '');
  } catch (e) {
    console.error('Simple AI error:', e);
    return null;
  }
};

// Get depth based on difficulty
const getSearchDepth = (difficulty: DifficultyLevel): number => {
  // Beginner: 1, Easy: 2, Medium: 3, Hard: 4, Expert: 5, Master: 6
  if (difficulty.skillLevel <= 1) return 1;
  if (difficulty.skillLevel <= 5) return 2;
  if (difficulty.skillLevel <= 10) return 3;
  if (difficulty.skillLevel <= 15) return 4;
  if (difficulty.skillLevel <= 18) return 5;
  return 6;
};

export const useStockfish = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DIFFICULTY_LEVELS[2]);
  const timeoutRef = useRef<number | null>(null);

  const getBestMove = useCallback(
    (fen: string): Promise<string | null> => {
      return new Promise((resolve) => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }

        // Use minimax for Medium difficulty and above
        const useMinimax = difficulty.skillLevel >= 10;
        const depth = getSearchDepth(difficulty);
        
        // Add thinking time for realism
        const thinkTime = 300 + difficulty.skillLevel * 30 + Math.random() * 200;

        timeoutRef.current = window.setTimeout(() => {
          let move: string | null;
          
          if (useMinimax) {
            move = getBestMoveWithMinimax(fen, depth);
          } else {
            move = getSimpleAIMove(fen, difficulty);
          }
          
          resolve(move);
        }, thinkTime);
      });
    },
    [difficulty]
  );

  return {
    isReady: true,
    getBestMove,
    difficulty,
    setDifficulty,
  };
};
