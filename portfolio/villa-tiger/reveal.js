import { portfolioView } from '../viewport.js';

const root = document.documentElement;
function sizeCanvas() {
  const desktop = portfolioView(window, 'villa-tiger') === 'desktop';
  if (desktop) {
    const scale = root.clientWidth / 1280;
    root.dataset.villaScale = scale;
    root.style.setProperty('--villa-scale', scale);
  } else {
    delete root.dataset.villaScale;
    root.style.removeProperty('--villa-scale');
  }
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);
document.addEventListener('portfolio:villa-canvas-sync', sizeCanvas);
new ResizeObserver(sizeCanvas).observe(root);

const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (!editing && !reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (reducedMotion.matches) continue;
      target.animate(
        [{ opacity: .45, transform: 'translateY(13px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      );
    }
  }, { threshold: .12 });

  for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
}

const sketch = document.querySelector('.villa-sketch');
if (sketch && !editing && !reducedMotion.matches && 'IntersectionObserver' in window) {
  const drawing = sketch.querySelector('.villa-sketch-drawing');
  const stages = [
    ['structure', 0, 1260],
    ['facade', 1100, 1890],
    ['pool', 2800, 1575],
    ['detail', 4100, 1450],
    ['shading', 5050, 1450],
  ];
  const animations = [];
  const visibleFraction = .3;
  sketch.dataset.drawing = '';

  function complete() {
    delete sketch.dataset.drawing;
    observer.disconnect();
    window.removeEventListener('pageshow', waitForScroll);
    window.removeEventListener('scroll', observeAfterScroll);
    reducedMotion.removeEventListener('change', reduce);
    for (const animation of animations) animation.cancel();
  }

  function reduce(event) {
    if (event.matches) complete();
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio < visibleFraction || !drawing.getClientRects().length) return;
    observer.disconnect();
    for (const [stage, start, length] of stages) {
      const paths = [...drawing.querySelectorAll(`.sketch-${stage} path`)];
      const lengths = paths.map(path => path.getTotalLength());
      const total = lengths.reduce((sum, value) => sum + value, 0);
      let delay = start;
      for (const [index, path] of paths.entries()) {
        const step = length * (.45 / paths.length + .55 * lengths[index] / total);
        const duration = Math.min(start + length - delay, step * 1.65);
        animations.push(path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          delay, duration, fill: 'both', easing: index % 3 === 0 ? 'cubic-bezier(.36,.2,.57,.86)' : 'linear',
        }));
        delay += step;
      }
    }
    Promise.all(animations.map(animation => animation.finished)).then(complete, () => {});
  }, { threshold: visibleFraction });

  let initialScroll;
  function observeAfterScroll() {
    if (window.scrollY === initialScroll) return;
    window.removeEventListener('scroll', observeAfterScroll);
    observer.observe(sketch);
  }

  function waitForScroll() {
    initialScroll = window.scrollY;
    window.addEventListener('scroll', observeAfterScroll, { passive: true });
  }

  reducedMotion.addEventListener('change', reduce);
  window.addEventListener('pageshow', waitForScroll, { once: true });
}
