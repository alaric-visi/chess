import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Square, Move, Color } from 'chess.js';
import { GameState } from '../../types/chess/chess';
import { useStockfish } from './useStockfish';

const createInitialState = (): GameState => ({
  fen: new Chess().fen(),
  selectedSquare: null,
  validMoves: [],
  lastMove: null,
  isThinking: false,
  gameOver: false,
  result: null,
  turn: 'w',
});

export const useChessGame = () => {
  const gameRef = useRef(new Chess());
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({
    white: [],
    black: [],
  });
  const [triggerAI, setTriggerAI] = useState(0);
  const [playerColor, setPlayerColor] = useState<Color>('w');

  const { getBestMove, difficulty, setDifficulty, isReady } = useStockfish();
  const game = gameRef.current;
  const computerColor = playerColor === 'w' ? 'b' : 'w';

  const syncGameState = useCallback(() => {
    const isGameOver = game.isGameOver();
    let result: string | null = null;

    if (isGameOver) {
      if (game.isCheckmate()) {
        result = game.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
      } else if (game.isDraw()) {
        result = 'Draw!';
      } else if (game.isStalemate()) {
        result = 'Stalemate!';
      } else if (game.isThreefoldRepetition()) {
        result = 'Draw by repetition!';
      } else if (game.isInsufficientMaterial()) {
        result = 'Draw - insufficient material!';
      }
    }

    setGameState((prev) => ({
      ...prev,
      fen: game.fen(),
      turn: game.turn(),
      gameOver: isGameOver,
      result,
    }));
    setMoveHistory([...game.history({ verbose: true })]);
  }, [game]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      // Only allow moves when it's the player's turn
      if (game.turn() !== playerColor || game.isGameOver() || gameState.isThinking) {
        return;
      }

      const clickedPiece = game.get(square);

      // Make a move if valid destination
      if (gameState.selectedSquare && gameState.validMoves.includes(square)) {
        try {
          const move = game.move({
            from: gameState.selectedSquare,
            to: square,
            promotion: 'q',
          });

          if (move) {
            if (move.captured) {
              // Player captured a piece - add to player's captures
              const capturedByKey = playerColor === 'w' ? 'black' : 'white';
              setCapturedPieces((prev) => ({
                ...prev,
                [capturedByKey]: [...prev[capturedByKey], move.captured!],
              }));
            }

            setGameState((prev) => ({
              ...prev,
              selectedSquare: null,
              validMoves: [],
              lastMove: { from: move.from, to: move.to },
            }));

            syncGameState();
            setTriggerAI((c) => c + 1);
          }
        } catch (e) {
          console.error('Move error:', e);
          setGameState((prev) => ({
            ...prev,
            selectedSquare: null,
            validMoves: [],
          }));
        }
        return;
      }

      // Select own piece (player's color)
      if (clickedPiece && clickedPiece.color === playerColor) {
        const moves = game.moves({ square, verbose: true });
        setGameState((prev) => ({
          ...prev,
          selectedSquare: square,
          validMoves: moves.map((m) => m.to),
        }));
        return;
      }

      // Deselect
      setGameState((prev) => ({
        ...prev,
        selectedSquare: null,
        validMoves: [],
      }));
    },
    [game, gameState.selectedSquare, gameState.validMoves, gameState.isThinking, syncGameState, playerColor]
  );

  // Computer turn effect - triggers when it's the computer's turn
  useEffect(() => {
    if (game.turn() !== computerColor || game.isGameOver()) {
      return;
    }

    let cancelled = false;

    const runAI = async () => {
      setGameState((prev) => ({ ...prev, isThinking: true }));

      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      const bestMove = await getBestMove(game.fen());
      if (cancelled) return;

      let moved = false;

      if (bestMove && bestMove.length >= 4) {
        const from = bestMove.substring(0, 2) as Square;
        const to = bestMove.substring(2, 4) as Square;
        const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

        try {
          const move = game.move({
            from,
            to,
            promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
          });

          if (move) {
            if (move.captured) {
              // Computer captured a piece
              const capturedByKey = computerColor === 'w' ? 'black' : 'white';
              setCapturedPieces((prev) => ({
                ...prev,
                [capturedByKey]: [...prev[capturedByKey], move.captured!],
              }));
            }
            setGameState((prev) => ({
              ...prev,
              lastMove: { from: move.from, to: move.to },
              isThinking: false,
            }));
            syncGameState();
            moved = true;
          }
        } catch (e) {
          console.error('Computer move error:', e);
        }
      }

      // Fallback random move
      if (!moved) {
        const moves = game.moves({ verbose: true });
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          try {
            const move = game.move({
              from: randomMove.from,
              to: randomMove.to,
              promotion: randomMove.promotion,
            });
            if (move) {
              if (move.captured) {
                const capturedByKey = computerColor === 'w' ? 'black' : 'white';
                setCapturedPieces((prev) => ({
                  ...prev,
                  [capturedByKey]: [...prev[capturedByKey], move.captured!],
                }));
              }
              setGameState((prev) => ({
                ...prev,
                lastMove: { from: move.from, to: move.to },
                isThinking: false,
              }));
              syncGameState();
              moved = true;
            }
          } catch (e) {
            console.error('Fallback move error:', e);
          }
        }
      }

      if (!moved) {
        setGameState((prev) => ({ ...prev, isThinking: false }));
      }
    };

    runAI();

    return () => {
    };
  }, [triggerAI, game, getBestMove, syncGameState, computerColor]);

  const newGame = useCallback(() => {
    game.reset();
    setGameState(createInitialState());
    setMoveHistory([]);
    setCapturedPieces({ white: [], black: [] });
    // If player is black, trigger AI for white's first move
    if (playerColor === 'b') {
      setTimeout(() => setTriggerAI((c) => c + 1), 100);
    } else {
      setTriggerAI(0);
    }
  }, [game, playerColor]);

  const [pieceSet, setPieceSet] = useState<'classic' | 'scifi' | 'fantasy'>('classic');

  const isPlayerTurn = game.turn() === playerColor && !gameState.isThinking && !game.isGameOver();

  return {
    gameState,
    game,
    moveHistory,
    capturedPieces,
    handleSquareClick,
    newGame,
    difficulty,
    setDifficulty,
    isEngineReady: isReady,
    isPlayerTurn,
    playerColor,
    setPlayerColor,
    pieceSet,
    setPieceSet,
  };
};
