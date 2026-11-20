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
if (sketch && !editing && !reducedMotion.matches && 'IntersectionObserver' in window
  && CSS.supports('mask-image', 'url(#villa-sketch-reveal)')) {
  const defs = document.querySelector('.villa-sketch-defs');
  const finish = defs.querySelector('.villa-sketch-finish');
  sketch.dataset.drawing = 'waiting';

  function complete() {
    delete sketch.dataset.drawing;
    defs.classList.remove('is-drawing');
    observer.disconnect();
    reducedMotion.removeEventListener('change', reduce);
  }

  function reduce(event) {
    if (event.matches) complete();
  }

  const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    try {
      await sketch.querySelector('img').decode();
    } catch {
      complete();
      return;
    }
    if ('drawing' in sketch.dataset) defs.classList.add('is-drawing');
  }, { threshold: .15 });

  finish.addEventListener('animationend', complete, { once: true });
  reducedMotion.addEventListener('change', reduce);
  observer.observe(sketch);
}
