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

  // Each photo has its own viewport cue. Never launch a whole row from the
  // first visible image: in the editorial layout the other frames can be far
  // below the viewport.
  const cues = new Map();
  for (const group of groups) {
    for (const [index, [slot, x, y, scale]] of group.entries()) {
      const frame = page.querySelector(`.ayam-news .story-${slot}:not([hidden]) .story-image`);
      const layer = frame?.querySelector('.story-reveal');
      if (layer && frame.getClientRects().length) {
        cues.set(frame, { frame, layer, x, y, scale, index, slot });
      }
    }
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
    const viewportHeight = win.innerHeight || page.documentElement.clientHeight;
    for (const record of records) {
      if (!record.isIntersecting || played.has(record.target)) continue;
      const cue = cues.get(record.target);
      if (!cue) continue;
      const rect = record.boundingClientRect;
      // An oversized editorial image should still play once a substantial
      // portion of the viewport contains it; ordinary images require at least
      // 55% of their height to be visible.
      const requiredVisible = Math.min(rect.height * .55, viewportHeight * .55);
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      if (visibleHeight < requiredVisible || rect.top > viewportHeight * .72) continue;
      reveal(cue, mobile);
    }
  }, { rootMargin: '0px', threshold: [0, .15, .3, .45, .55, .7, .85] });
  for (const frame of cues.keys()) observer.observe(frame);
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    for (const effect of animations) effect.cancel();
  });
}
