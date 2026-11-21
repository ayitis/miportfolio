export function frameUpdate(apply) {
  let frame;
  let pending;
  function flush() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    if (!pending) return;
    const args = pending;
    pending = undefined;
    apply(...args);
  }
  return {
    schedule(...args) {
      pending = args;
      if (frame === undefined) frame = requestAnimationFrame(flush);
    },
    flush,
  };
}
