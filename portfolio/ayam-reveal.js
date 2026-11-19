import { portfolioView } from './viewport.js';

const groups = [
  [['a', -18, 13, 1.18], ['b', 9, 15, 1.17], ['c', 22, -9, 1.21]],
  [['e', 0, 24, 1.29], ['d', -20, 10, 1.17], ['f', 21, 12, 1.18]],
  [['g', -12, 13, 1.15], ['h', 0, 14, 1.17], ['i', 12, 13, 1.15]],
];

export function startAyamReveals(page) {
  const win = page.defaultView;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !win.IntersectionObserver || !win.Element.prototype.animate) return;

  const cues = new Map();
  for (const group of groups) {
    const entries = group.flatMap(([slot, x, y, scale], index) => {
      const frame = page.querySelector(`.ayam-news .story-${slot}:not([hidden]) .story-image`);
      const layer = frame?.querySelector('.story-reveal');
      return layer ? [{ frame, layer, x, y, scale, index, slot }] : [];
    });
    for (const entry of entries) cues.set(entry.frame, { entry, entries });
  }
  const played = new Set();
  const animations = new Set();

  function reveal({ frame, layer, x, y, scale, index, slot }, mobile) {
    if (played.has(frame)) return;
    played.add(frame);
    observer.unobserve(frame);
    const distance = mobile ? .4 : 1;
    const zoom = mobile ? 1 + (scale - 1) * .6 : scale;
    const effect = layer.animate([
      { opacity: .62, transform: `translate(${x * distance}px, ${y * distance}px) scale(${zoom})` },
      { opacity: 1, transform: 'none' },
    ], {
      duration: slot === 'e' ? 540 : (slot === 'd' || slot === 'f' ? 370 : 430),
      delay: index * 95,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards',
    });
    animations.add(effect);
    effect.finished.catch(() => {}).finally(() => animations.delete(effect));
  }

  const observer = new win.IntersectionObserver(records => {
    if (reduced.matches) return;
    const mobile = portfolioView(win, 'ayam') === 'mobile';
    for (const record of records) {
      if (!record.isIntersecting) continue;
      const { entry, entries } = cues.get(record.target);
      for (const cue of mobile ? [entry] : entries) reveal(cue, mobile);
    }
  }, { rootMargin: '0px 0px 8% 0px' });
  for (const frame of cues.keys()) observer.observe(frame);
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    for (const effect of animations) effect.cancel();
  });
}
