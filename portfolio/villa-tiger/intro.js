import { portfolioView } from '../viewport.js';
import { introAsset, readVillaIntro } from './intro-settings.js';

const stage = document.querySelector('.villa-intro');
const backgrounds = stage.querySelector('.villa-intro-scenes');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// One new illustration every second, including the crossfade.
const slideInterval = 1000;
let slides = [];
let settings;
let signature;
let elapsed = 0;
let previousTime;
let frame;
let visible = false;

function paint() {
  if (!slides.length) return;
  const current = Math.floor(elapsed / slideInterval) % slides.length;
  const next = (current + 1) % slides.length;
  const phase = elapsed % slideInterval;
  const progress = phase / slideInterval;
  // Preserve editor-selectable fade duration without slowing the one-second cycle.
  const fadeDuration = Math.min(settings.transition, slideInterval);
  const fade = slides.length > 1 && !reducedMotion.matches
    ? Math.max(0, (phase - (slideInterval - fadeDuration)) / fadeDuration) : 0;
  const eased = fade * fade * (3 - 2 * fade);

  slides.forEach((image, index) => {
    const outgoing = index === current;
    const incoming = index === next && fade > 0;
    const opacity = outgoing ? 1 : incoming ? eased : 0;
    image.style.opacity = opacity;
    image.style.zIndex = incoming ? '2' : '1';
    if (opacity) image.style.scale = reducedMotion.matches ? 1 : 1.015 + .055 * (incoming ? fade * .2 : .2 + progress * .8);
  });
}

function tick(time) {
  elapsed = (elapsed + (previousTime === undefined ? 0 : time - previousTime))
    % (slideInterval * slides.length);
  previousTime = time;
  paint();
  frame = requestAnimationFrame(tick);
}

function playback() {
  if (visible && !document.hidden && !reducedMotion.matches && slides.length > 1) {
    if (frame === undefined) frame = requestAnimationFrame(tick);
  } else {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
  }
}

async function apply(next) {
  settings = next;
  stage.style.setProperty('--villa-intro-logo-size', `${settings.logoSize}%`);
  const key = JSON.stringify(next.scenes);
  if (key === signature) {
    paint();
    return;
  }
  signature = key;

  const ready = await Promise.all(next.scenes.map(async ({ scene, src }) => {
    const image = new Image();
    image.alt = '';
    image.dataset.scene = scene;
    image.src = src;
    try {
      await image.decode();
    } catch {
      if (src === introAsset(scene)) return null;
      image.src = introAsset(scene);
      try { await image.decode(); } catch { return null; }
    }
    return image;
  }));
  if (signature !== key || !ready.some(Boolean)) return;

  slides = ready.filter(Boolean);
  elapsed = 0;
  previousTime = undefined;
  paint();
  backgrounds.replaceChildren(...slides);
  playback();
}

const observer = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting && entry.intersectionRatio > 0;
  playback();
});
observer.observe(stage);
document.addEventListener('visibilitychange', playback);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) elapsed = 0;
  paint();
  playback();
});
let customSettings = false;
document.addEventListener('portfolio:villa-intro', event => {
  customSettings = true;
  apply(event.detail);
});
function useDefaults() {
  if (!customSettings) apply(readVillaIntro(undefined, portfolioView(window, 'villa-tiger')));
}
window.addEventListener('resize', useDefaults);
useDefaults();
