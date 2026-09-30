/**
 * Run a callback on the next frame. Drop-in replacement for
 * InteractionManager.runAfterInteractions, which waits for every running animation
 * (including screen transitions) to finish and added a fixed delay to each page open.
 */
export function runSoon(callback: () => void): { cancel: () => void } {
  const id = requestAnimationFrame(callback);
  return { cancel: () => cancelAnimationFrame(id) };
}
