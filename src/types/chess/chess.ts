export type PieceSet = 'classic' | 'scifi' | 'fantasy' | 'forest' | 'underwater';

export const PIECE_SETS: { id: PieceSet; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'scifi', name: 'Sci-Fi' },
  { id: 'fantasy', name: 'Fantasy' },
  { id: 'forest', name: 'Forest' },
  { id: 'underwater', name: 'Underwater' },
];
