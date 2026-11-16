import { Move, Chess, Color } from 'chess.js';
import { DifficultyLevel, DIFFICULTY_LEVELS } from '../../types/chess/chess';
import { CapturedPieces } from './CapturedPieces';
import { MoveHistory } from './MoveHistory';
import { RotateCcw, Cpu, User, Loader2 } from 'lucide-react';

interface GamePanelProps {
  game: Chess;
  moveHistory: Move[];
  capturedPieces: { white: string[]; black: string[] };
  isThinking: boolean;
  gameOver: boolean;
  result: string | null;
  onNewGame: () => void;
  difficulty: DifficultyLevel;
  onDifficultyChange: (level: DifficultyLevel) => void;
  isEngineReady: boolean;
  playerColor: Color;
  onPlayerColorChange: (color: Color) => void;
  pieceSet: 'classic' | 'scifi' | 'fantasy';
  onPieceSetChange: (set: 'classic' | 'scifi' | 'fantasy') => void;
  className?: string;
}

export const GamePanel = ({
  game,
  moveHistory,
  capturedPieces,
  isThinking,
  gameOver,
  result,
  onNewGame,
  difficulty,
  onDifficultyChange,
  isEngineReady,
  playerColor,
  onPlayerColorChange,
  pieceSet,
  onPieceSetChange,
}: GamePanelProps) => {
  const currentTurn = game.turn();
  const isInCheck = game.isCheck();

  const buttonClass = "w-full flex items-center justify-center px-4 py-2 font-label-mono text-[10px] uppercase transition-colors cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] border bg-transparent text-primary border-primary hover:bg-primary hover:text-on-primary dark:text-on-primary dark:border-on-primary dark:hover:bg-on-primary dark:hover:text-primary";
  const selectClass = "w-full h-8 px-2 font-label-mono text-[10px] uppercase bg-transparent border border-primary/50 text-primary focus:outline-none focus:border-primary dark:text-on-primary dark:border-on-primary/50 dark:focus:border-on-primary dark:bg-black";

  return (
    <div className="flex flex-col h-full space-y-4 font-label-mono text-primary dark:text-on-primary">
      {/* Settings Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase opacity-70">Difficulty</label>
          <select
            value={difficulty.name}
            onChange={(e) => {
              const level = DIFFICULTY_LEVELS.find(l => l.name === e.target.value);
              if (level) onDifficultyChange(level);
            }}
            className={selectClass}
          >
            {DIFFICULTY_LEVELS.map(level => (
              <option key={level.name} value={level.name} className="dark:bg-black">
                {level.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase opacity-70">Play as</label>
          <select
            value={playerColor}
            onChange={(e) => onPlayerColorChange(e.target.value as Color)}
            className={selectClass}
          >
            <option value="w" className="dark:bg-black">White</option>
            <option value="b" className="dark:bg-black">Black</option>
          </select>
        </div>

        <div className="space-y-1.5 col-span-2">
          <label className="text-[10px] uppercase opacity-70">Piece Set</label>
          <select
            value={pieceSet}
            onChange={(e) => onPieceSetChange(e.target.value as 'classic' | 'scifi' | 'fantasy')}
            className={selectClass}
          >
            <option value="classic" className="dark:bg-black">Classic</option>
            <option value="scifi" className="dark:bg-black">Sci-Fi</option>
            <option value="fantasy" className="dark:bg-black">Fantasy</option>
          </select>
        </div>
      </div>

      {!isEngineReady && (
        <div className="flex items-center gap-2 text-[10px] uppercase opacity-70">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading engine...
        </div>
      )}

      {/* Turn Indicator */}
      <div className={`flex items-center gap-2 p-2 border text-[10px] uppercase font-bold transition-colors ${
          currentTurn === playerColor
            ? 'border-green-500 text-green-500 bg-green-500/10'
            : 'border-primary/30 opacity-70'
        }`}>
        {currentTurn === playerColor ? (
          <User className="h-3 w-3" />
        ) : (
          <Cpu className="h-3 w-3" />
        )}
        <span>{currentTurn === playerColor ? 'Your turn' : 'Computer thinking...'}</span>
        {isThinking && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
      </div>

      {/* Game Status */}
      {(gameOver || isInCheck) && (
        <div className={`p-2 text-center text-[10px] uppercase font-bold border animate-pulse ${
            gameOver
              ? 'border-red-500 text-red-500 bg-red-500/10'
              : 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
          }`}>
          {result || (isInCheck ? 'Check!' : '')}
        </div>
      )}

      {/* Captured Pieces */}
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase opacity-70">Captured pieces</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] uppercase opacity-70">
              <Cpu className="h-3 w-3" /> Computer
            </div>
            <CapturedPieces pieces={capturedPieces.white} color="w" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] uppercase opacity-70">
              <User className="h-3 w-3" /> You
            </div>
            <CapturedPieces pieces={capturedPieces.black} color="b" />
          </div>
        </div>
      </div>

      {/* Move History */}
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase opacity-70">Move history</h3>
        <MoveHistory moves={moveHistory} />
      </div>

      {/* New Game Button */}
      <div className="pt-2 mt-auto">
          <button onClick={onNewGame} className={buttonClass}>
            <RotateCcw className="h-3 w-3 mr-2" />
            New Game
          </button>
      </div>
      
      {/* Instructions */}
      <div className="text-[9px] uppercase opacity-50 space-y-0.5 pt-2 border-t border-primary/20 text-center">
        <p>Click to select • Green = valid moves</p>
        <p>Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
};
