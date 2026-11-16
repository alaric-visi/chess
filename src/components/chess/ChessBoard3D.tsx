import { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Chess, Square, Color, PieceSymbol } from 'chess.js';
import { ChessPiece3D } from './ChessPiece3D';
import { ChessPieceSciFi3D } from './ChessPieceSciFi3D';
import { ChessPieceFantasy3D } from './ChessPieceFantasy3D';

interface ChessBoard3DProps {
  game: Chess;
  selectedSquare: Square | null;
  validMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
  onSquareClick: (square: Square) => void;
  isPlayerTurn: boolean;
  playerColor: Color;
  pieceSet: 'classic' | 'scifi' | 'fantasy';
}

const SQUARE_SIZE = 1;
const BOARD_SIZE = 8;
const BOARD_OFFSET = (BOARD_SIZE - 1) * SQUARE_SIZE / 2;

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

// Chess.com style colors
const LIGHT_SQUARE = '#EEEED2';
const DARK_SQUARE = '#769656';
const SELECTED_COLOR = '#BACA44';
const LAST_MOVE_LIGHT = '#F5F682';
const LAST_MOVE_DARK = '#BACA44';
const BOARD_FRAME_COLOR = '#302E2B';

// Tracked piece with persistent ID
interface TrackedPiece {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
  targetX: number;
  targetZ: number;
}

// Convert square to 3D coordinates
const squareToPosition = (square: Square): { x: number; z: number } => {
  const col = square.charCodeAt(0) - 97;
  const row = parseInt(square[1]) - 1;
  const x = col * SQUARE_SIZE - BOARD_OFFSET;
  const z = (7 - (7 - row)) * SQUARE_SIZE - BOARD_OFFSET;
  return { x, z };
};

// Create unique ID for piece based on initial position
const createPieceId = (square: Square, type: PieceSymbol, color: Color): string => {
  return `${color}${type}${square}`;
};

export function ChessBoard3D({ 
  game, 
  selectedSquare, 
  validMoves, 
  lastMove,
  onSquareClick,
  isPlayerTurn,
  playerColor,
  pieceSet,
}: ChessBoard3DProps) {
  const [trackedPieces, setTrackedPieces] = useState<TrackedPiece[]>([]);
  const lastFenRef = useRef<string>('');
  const isInitializedRef = useRef(false);

  // Build current board state
  const currentBoard = useMemo(() => {
    const boardData: Array<{ square: Square; type: PieceSymbol; color: Color; x: number; z: number }> = [];
    const board = game.board();
    
    board.forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        if (piece) {
          const square = `${files[colIndex]}${ranks[7 - rowIndex]}` as Square;
          const { x, z } = squareToPosition(square);
          boardData.push({ square, type: piece.type, color: piece.color, x, z });
        }
      });
    });
    
    return boardData;
  }, [game.fen()]);

  // Initialize or update tracked pieces
  useEffect(() => {
    const currentFen = game.fen();
    
    // First initialization
    if (!isInitializedRef.current) {
      const initialPieces = currentBoard.map(p => ({
        id: createPieceId(p.square, p.type, p.color),
        type: p.type,
        color: p.color,
        square: p.square,
        targetX: p.x,
        targetZ: p.z,
      }));
      setTrackedPieces(initialPieces);
      lastFenRef.current = currentFen;
      isInitializedRef.current = true;
      return;
    }
    
    // Skip if FEN hasn't changed
    if (currentFen === lastFenRef.current) return;
    
    // Update pieces based on the move
    setTrackedPieces(prevPieces => {
      const newPieces: TrackedPiece[] = [];
      const usedPrevIds = new Set<string>();
      
      for (const boardPiece of currentBoard) {
        let matchedPiece: TrackedPiece | undefined;
        
        // If this is the destination of the last move, find the piece that moved
        if (lastMove && lastMove.to === boardPiece.square) {
          matchedPiece = prevPieces.find(p => 
            p.square === lastMove.from && 
            p.type === boardPiece.type && 
            p.color === boardPiece.color &&
            !usedPrevIds.has(p.id)
          );
        }
        
        // Otherwise, look for a piece already at this square
        if (!matchedPiece) {
          matchedPiece = prevPieces.find(p => 
            p.square === boardPiece.square && 
            p.type === boardPiece.type && 
            p.color === boardPiece.color &&
            !usedPrevIds.has(p.id)
          );
        }
        
        if (matchedPiece) {
          usedPrevIds.add(matchedPiece.id);
          newPieces.push({
            ...matchedPiece,
            square: boardPiece.square,
            targetX: boardPiece.x,
            targetZ: boardPiece.z,
          });
        } else {
          // New piece (promotion or respawn)
          newPieces.push({
            id: createPieceId(boardPiece.square, boardPiece.type, boardPiece.color) + '-' + Date.now(),
            type: boardPiece.type,
            color: boardPiece.color,
            square: boardPiece.square,
            targetX: boardPiece.x,
            targetZ: boardPiece.z,
          });
        }
      }
      
      return newPieces;
    });
    
    lastFenRef.current = currentFen;
  }, [game.fen(), lastMove, currentBoard]);

  const board = useMemo(() => game.board(), [game.fen()]);
  
  // Rotate the entire board 180° when player is white so their pieces are at the bottom (front)
  const boardRotation = playerColor === 'w' ? Math.PI : 0;

  return (
    <group rotation={[0, boardRotation, 0]}>
      {/* Board frame */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[BOARD_SIZE + 0.8, 0.2, BOARD_SIZE + 0.8]} />
        <meshStandardMaterial color={BOARD_FRAME_COLOR} roughness={0.8} />
      </mesh>

      {/* Render squares */}
      {board.map((row, rowIndex) => 
        row.map((piece, colIndex) => {
          const square = `${files[colIndex]}${ranks[7 - rowIndex]}` as Square;
          const isLight = (rowIndex + colIndex) % 2 === 1;
          const isSelected = selectedSquare === square;
          const isValidMove = validMoves.includes(square);
          const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
          
          const x = colIndex * SQUARE_SIZE - BOARD_OFFSET;
          const z = (7 - rowIndex) * SQUARE_SIZE - BOARD_OFFSET;

          // Determine square appearance
          let squareColor = isLight ? LIGHT_SQUARE : DARK_SQUARE;
          if (isSelected) {
            squareColor = SELECTED_COLOR;
          } else if (isLastMoveSquare) {
            squareColor = isLight ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;
          }

          return (
            <group key={square}>
              {/* Square */}
              <mesh
                position={[x, 0.01, z]}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlayerTurn || (piece && piece.color === playerColor)) {
                    onSquareClick(square);
                  }
                }}
                receiveShadow
              >
                <boxGeometry args={[SQUARE_SIZE * 0.98, 0.02, SQUARE_SIZE * 0.98]} />
                <meshStandardMaterial 
                  color={squareColor}
                  roughness={0.6}
                />
              </mesh>

              {/* Valid move indicator */}
              {isValidMove && !piece && (
                <mesh position={[x, 0.05, z]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
                  <meshStandardMaterial color="#4ADE80" transparent opacity={0.8} />
                </mesh>
              )}
              
              {/* Capture indicator */}
              {isValidMove && piece && (
                <mesh position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.35, 0.45, 32]} />
                  <meshStandardMaterial color="#FF4444" side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
              )}
            </group>
          );
        })
      )}
      
      {/* Render pieces with animation */}
      {trackedPieces.map((piece) => {
        let PieceComponent = ChessPiece3D;
        if (pieceSet === 'scifi') PieceComponent = ChessPieceSciFi3D;
        if (pieceSet === 'fantasy') PieceComponent = ChessPieceFantasy3D;
        
        return (
          <PieceComponent
            key={piece.id}
            type={piece.type}
            color={piece.color}
            position={[piece.targetX, 0, piece.targetZ]}
            isSelected={selectedSquare === piece.square}
            onClick={() => onSquareClick(piece.square)}
          />
        );
      })}
    </group>
  );
}
