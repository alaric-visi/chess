// Classic ships in the main bundle; the other sets load on first use (and
// are preloaded when the browser is idle, so switching is usually instant).
export const loadSciFi = () => import('./ChessPieceSciFi3D').then((m) => ({ default: m.ChessPieceSciFi3D }));
export const loadFantasy = () =>
  import('./ChessPieceFantasy3D').then((m) => ({ default: m.ChessPieceFantasy3D }));

export const loadForest = () =>
  import('./ChessPieceForest3D').then((m) => ({ default: m.ChessPieceForest3D }));
export const loadUnderwater = () =>
  import('./ChessPieceUnderwater3D').then((m) => ({ default: m.ChessPieceUnderwater3D }));

export const preloadPieceSets = () => {
  void loadSciFi();
  void loadFantasy();
  void loadForest();
  void loadUnderwater();
};
