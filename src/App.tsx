import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { ChessBoard3D } from './components/chess/ChessBoard3D';
import { GamePanel } from './components/chess/GamePanel';
import { useChessGame } from './hooks/chess/useChessGame';

export default function App() {
  const {
    gameState,
    game,
    moveHistory,
    capturedPieces,
    handleSquareClick,
    newGame,
    difficulty,
    setDifficulty,
    isEngineReady,
    isPlayerTurn,
    playerColor,
    setPlayerColor,
    pieceSet,
    setPieceSet,
  } = useChessGame();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chess3d_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('chess3d_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement && !(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      el.requestFullscreen?.() || (el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || (document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
    }
  };

  const buttonClass =
    'px-4 py-2 font-label-mono text-[10px] uppercase transition-colors cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] border bg-transparent text-primary border-primary hover:bg-primary hover:text-on-primary dark:text-on-primary dark:border-on-primary dark:hover:bg-on-primary dark:hover:text-primary';

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen bg-surface-container-lowest dark:bg-primary flex flex-col overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex-none flex items-center justify-between px-6 md:px-10 py-4 border-b border-primary/20 dark:border-on-primary/20 text-primary dark:text-on-primary">
        <div className="flex items-center gap-3">
          <h1 className="font-label-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 border bg-transparent text-primary border-primary dark:text-on-primary dark:border-on-primary">
            CHESS 3D
          </h1>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className={`${buttonClass} md:hidden`}
          >
            {showMobileMenu ? 'Hide Controls' : 'Controls'}
          </button>
          <button onClick={() => setIsDark((d) => !d)} className={buttonClass}>
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button onClick={newGame} className={`${buttonClass} hidden md:block`}>
            New Game
          </button>
          <button onClick={toggleFullscreen} className={`${buttonClass} hidden md:block`}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative w-full h-full min-h-0 bg-transparent overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative w-full h-full min-w-0 min-h-0 overflow-hidden">
          <Canvas
            shadows
            className="w-full h-full"
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            gl={{ antialias: true, alpha: true }}
          >
            <PerspectiveCamera makeDefault position={[0, 7.7, 7.7]} fov={45} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={6}
              maxDistance={25}
              minPolarAngle={0.1}
              maxPolarAngle={Math.PI / 2.1}
              target={[0, -1.5, 0]}
            />

            <Environment preset="city" />
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[10, 15, 10]}
              intensity={1.2}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-far={50}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
            />
            <directionalLight position={[-8, 10, -8]} intensity={0.4} />
            <pointLight position={[0, 12, 0]} intensity={0.5} />

            <ChessBoard3D
              game={game}
              selectedSquare={gameState.selectedSquare}
              validMoves={gameState.validMoves}
              lastMove={gameState.lastMove}
              onSquareClick={handleSquareClick}
              isPlayerTurn={isPlayerTurn}
              playerColor={playerColor}
              pieceSet={pieceSet}
            />
          </Canvas>

          {/* Game over modal */}
          {gameState.gameOver && gameState.result && (
            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="text-center font-label-mono text-primary dark:text-on-primary border border-primary dark:border-on-primary p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] bg-white dark:bg-black">
                <h2 className="text-2xl font-bold uppercase tracking-widest mb-4">Game Over</h2>
                <p className="mb-6 uppercase text-[10px]">{gameState.result}</p>
                <button onClick={newGame} className={buttonClass}>
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div
          className={`
            md:block md:relative md:w-80 md:border-l md:border-primary/20 dark:md:border-on-primary/20
            bg-white/90 dark:bg-black/90 backdrop-blur-md
            ${showMobileMenu ? 'absolute inset-0 z-40 block p-8' : 'hidden p-4 h-full overflow-hidden'}
          `}
        >
          <GamePanel
            game={game}
            moveHistory={moveHistory}
            capturedPieces={capturedPieces}
            isThinking={gameState.isThinking}
            gameOver={gameState.gameOver}
            result={gameState.result}
            onNewGame={newGame}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            isEngineReady={isEngineReady}
            playerColor={playerColor}
            onPlayerColorChange={setPlayerColor}
            pieceSet={pieceSet}
            onPieceSetChange={setPieceSet}
          />
        </div>
      </div>
    </div>
  );
}

