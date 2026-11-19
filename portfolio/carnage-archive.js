const archive = document.querySelector('#campaign');
const runway = archive.querySelector('.archive-runway');
const stage = archive.querySelector('.archive-stage');
const cards = [...stage.querySelectorAll('figure')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 650px)');

// Editorial rows use different margins, proportions and vertical offsets.
// All sizes are relative to the stage width so the composition reflows.
const desktopRows = [
  [[.02, .37, .04, .46], [.43, .23, .00, .28], [.70, .29, .12, .30]],
  [[.11, .24, .05, .33], [.40, .40, .00, .31], [.83, .16, .09, .23]],
  [[.00, .39, .02, .30], [.43, .19, .17, .25], [.65, .33, .05, .40]],
  [[.08, .23, .12, .29], [.33, .36, .00, .26], [.73, .25, .08, .30]],
  [[.00, .27, .06, .35], [.31, .17, .00, .22], [.51, .20, .14, .25], [.74, .26, .03, .34]],
];
const mobileRows = [
  [[.00, .54, .00, .73], [.58, .42, .17, .45]],
  [[.11, .78, .00, .60]],
  [[.00, .44, .09, .62], [.49, .51, .00, .63]],
  [[.03, .58, .00, .68], [.66, .34, .25, .42]],
  [[.18, .82, .00, .61]],
];
const spread = [
  [.50, .52, 1, 0], [.26, .28, .91, -8], [.71, .23, .78, 7], [.46, .18, .64, -5],
  [.81, .51, .92, 8], [.15, .49, .76, -8], [.34, .73, .84, -6], [.61, .78, .90, 6],
  [.86, .75, .70, 10], [.17, .77, .61, 7], [.33, .43, .65, 9], [.67, .38, .69, -8],
  [.78, .65, .74, -8], [.23, .58, .72, 5], [.48, .83, .64, -5], [.58, .25, .70, 11],
];

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);
const mix = (a, b, progress) => a + (b - a) * progress;
const state = (x, y, width, height, rotation = 0, opacity = 1) =>
  [x - width / 2, y - height / 2, width, height, rotation, opacity];

let scenes, distance, frame, lastProgress;

function finalComposition(width, height) {
  const rows = narrow.matches ? mobileRows : desktopRows;
  const positions = [];
  let top = height * .15;
  let row = 0;
  while (positions.length < cards.length) {
    let bottom = top;
    for (const [left, size, offset, ratio] of rows[row % rows.length]) {
      if (positions.length === cards.length) break;
      const y = top + offset * width;
      positions.push([left * width, y, size * width, ratio * width, 0, 1]);
      bottom = Math.max(bottom, y + ratio * width);
    }
    top = bottom + width * (narrow.matches ? .075 : .055);
    row++;
  }
  archive.style.setProperty('--archive-tail', `${Math.max(0, top - height)}px`);
  return positions;
}

function measure() {
  if (reducedMotion.matches) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  distance = Math.round(height * (narrow.matches ? 2.15 : 2.7));
  archive.style.setProperty('--archive-distance', `${distance}px`);
  const coverWidth = Math.min(width * (narrow.matches ? .44 : .19), height * .24, 250);
  const collageWidth = Math.min(width * (narrow.matches ? .55 : .25), height * .40);
  const bandWidth = width * (narrow.matches ? .99 : .86);
  const stripWidth = bandWidth / cards.length;
  const final = finalComposition(width, height);
  scenes = cards.map((_, i) => {
    const [x, y, scale, tilt] = spread[i % spread.length];
    const pieceWidth = collageWidth * scale;
    const pieceHeight = pieceWidth * (i % 3 === 1 ? .82 : 1.2);
    return [
      state(width / 2, height * .5, coverWidth, coverWidth * 1.32, 0, i === 0 ? 1 : 0),
      state(width * (narrow.matches ? mix(.5, x, .84) : x), height * y,
        pieceWidth, pieceHeight, tilt * (narrow.matches ? .65 : 1)),
      state((width - bandWidth) / 2 + stripWidth * (i + .5), height * .51,
        stripWidth + .5, height * (narrow.matches ? .19 : .29)),
      final[i],
    ];
  });
  lastProgress = undefined;
  render();
}

function render() {
  frame = undefined;
  if (!scenes || reducedMotion.matches) return;
  const progress = clamp(-runway.getBoundingClientRect().top / distance);
  if (progress === lastProgress) return;
  lastProgress = progress;
  const phase = progress < .43 ? 0 : progress < .69 ? 1 : 2;
  const segment = phase === 0 ? clamp((progress - .10) / .33)
    : phase === 1 ? (progress - .43) / .26 : (progress - .69) / .31;
  archive.classList.toggle('is-unfolded', progress === 1);
  cards.forEach((card, i) => {
    const delay = phase === 0 && i ? (i / cards.length) * .28 : 0;
    const amount = ease(clamp((segment - delay) / (1 - delay)));
    const [start, end] = scenes[i].slice(phase, phase + 2);
    const [x, y, width, height, rotation, opacity] = start.map((value, j) => mix(value, end[j], amount));
    card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.opacity = opacity;
    card.style.zIndex = i === 0 ? 2 : 1;
    card.toggleAttribute('inert', opacity === 0);
  });
}

function scheduleRender() {
  if (frame === undefined && !reducedMotion.matches) frame = requestAnimationFrame(render);
}
function syncMode() {
  archive.classList.toggle('is-scrubbed', !reducedMotion.matches);
  if (reducedMotion.matches) {
    archive.classList.remove('is-unfolded');
    for (const card of cards) {
      card.removeAttribute('style');
      card.removeAttribute('inert');
    }
  } else measure();
}

// Begin fetching the lightweight archive as the reader approaches the section.
const preloader = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  for (const image of stage.querySelectorAll('img')) image.loading = 'eager';
  preloader.disconnect();
}, { rootMargin: '650px 0px' });
preloader.observe(archive);

window.addEventListener('scroll', scheduleRender, { passive: true });
window.addEventListener('resize', measure);
reducedMotion.addEventListener('change', syncMode);
syncMode();
