const axes = {
  x: { start: 'left', end: 'right', crossStart: 'top', crossEnd: 'bottom' },
  y: { start: 'top', end: 'bottom', crossStart: 'left', crossEnd: 'right' },
};

const acquire = 5;
const release = 8;

export function shiftRect(rect, x, y) {
  return { left: rect.left + x, right: rect.right + x, top: rect.top + y, bottom: rect.bottom + y };
}

function anchors(rect, axis) {
  const { start, end } = axes[axis];
  return [rect[start], (rect[start] + rect[end]) / 2, rect[end]];
}

function closest(axis, source, references, fixed, lock, magnetic) {
  const values = anchors(source, axis);
  const candidates = [];
  for (const { id, rect } of references) {
    anchors(rect, axis).forEach((target, index) => {
      candidates.push({ id, index, target, rect, delta: target - values[index] });
    });
  }
  for (const { id, target, center } of fixed) {
    values.forEach((value, index) => {
      if (!center || index === 1) candidates.push({ id, index, target, delta: target - value });
    });
  }
  if (magnetic && lock) {
    const held = candidates.find(({ id, index }) => id === lock.id && index === lock.index);
    if (held && Math.abs(held.delta) <= release) return held;
  }
  const threshold = magnetic ? acquire : 1;
  let best;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.delta);
    if (distance <= threshold && (!best || distance < Math.abs(best.delta))) best = candidate;
  }
  return best;
}

export function alignRect(source, references, fixed, locks, snapping) {
  const result = { x: 0, y: 0, lines: [], locks: {} };
  for (const axis of ['x', 'y']) {
    const match = closest(axis, source, references, fixed[axis], locks[axis], snapping[axis]);
    if (!match) continue;
    if (snapping[axis]) {
      result[axis] = match.delta;
      result.locks[axis] = match;
    }
    result.lines.push({ axis, at: match.target, reference: match.rect });
  }
  return result;
}

export function spacingBetween(source, references) {
  const measures = [];
  for (const [axis, { start, end, crossStart, crossEnd }] of Object.entries(axes)) {
    let nearest;
    for (const { rect } of references) {
      const low = Math.max(source[crossStart], rect[crossStart]);
      const high = Math.min(source[crossEnd], rect[crossEnd]);
      if (high - low < 2) continue;
      const from = Math.min(source[end], rect[end]);
      const to = Math.max(source[start], rect[start]);
      const gap = to - from;
      if (gap < 2 || gap > 160 || (nearest && gap >= nearest.gap)) continue;
      nearest = { axis, from, to, at: (low + high) / 2, gap };
    }
    if (nearest) measures.push(nearest);
  }
  return measures;
}
