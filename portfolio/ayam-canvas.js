import { portfolioView } from './viewport.js';

const reference = { width: 1190, height: 730 };

export function scheduleCanvasSize(page) {
  if (page.documentElement.dataset.ayamScale) page.dispatchEvent(new Event('portfolio:ayam-canvas-size'));
}

export function designScale(page) {
  return Number(page.documentElement.dataset.ayamScale) || 1;
}

export function mountAyamCanvas(page) {
  const root = page.documentElement;
  const win = page.defaultView;
  const canvas = page.querySelector('[data-design-canvas]');
  function update() {
    const desktop = portfolioView(win, 'ayam') === 'desktop';
    if (!desktop) {
      delete root.dataset.ayamScale;
      root.style.removeProperty('--ayam-vw');
      root.style.removeProperty('--ayam-svh');
      return;
    }
    const scale = root.clientWidth / reference.width;
    root.style.setProperty('--ayam-width', `${reference.width}px`);
    root.style.setProperty('--ayam-vw', `${reference.width / 100}px`);
    root.style.setProperty('--ayam-svh', `${reference.height / 100}px`);
    root.style.setProperty('--ayam-scale', scale);
    root.dataset.ayamScale = scale;
    root.style.setProperty('--ayam-height', `${Math.ceil(canvas.scrollHeight * scale)}px`);
  }
  let frame;
  function schedule() {
    if (frame !== undefined) return;
    frame = win.requestAnimationFrame(() => {
      frame = undefined;
      update();
    });
  }
  page.addEventListener('portfolio:ayam-canvas-size', schedule);
  page.addEventListener('portfolio:ayam-canvas-sync', update);
  win.addEventListener('resize', update);
  // Also account for classic scrollbars appearing as the document loads.
  const sizes = new ResizeObserver(update);
  sizes.observe(root);
  sizes.observe(canvas);
  update();
}
