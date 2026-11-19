const archive = document.querySelector('#campaign');
const runway = archive.querySelector('.archive-runway');
const stage = archive.querySelector('.archive-stage');
const cards = [...stage.querySelectorAll('figure')];
const cover = cards[0].querySelector('img');
const coverAspect = Number(cover.getAttribute('width')) / Number(cover.getAttribute('height'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 650px)');

// Variable widths stagger the seams while each row fills the stage edge to edge.
const desktopRows = [
  { height: .43, widths: [5, 3, 4] },
  { height: .28, widths: [3, 2, 4, 3] },
  { height: .36, widths: [4, 5, 3] },
  { height: .31, widths: [3, 4, 5] },
  { height: .33, widths: [5, 3, 4] },
];
const mobileRows = [
  { height: .68, widths: [7, 5] },
  { height: .63, widths: [5, 7] },
  { height: .45, widths: [1] },
  { height: .61, widths: [6, 6] },
  { height: .57, widths: [7, 5] },
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
  let top = Math.round(height * .15);
  let row = 0;
  while (positions.length < cards.length) {
    const shape = rows[row % rows.length];
    const widths = shape.widths.slice(0, cards.length - positions.length);
    const total = widths.reduce((sum, size) => sum + size, 0);
    const rowHeight = Math.round(shape.height * width);
    let left = 0;
    let used = 0;
    for (const size of widths) {
      used += size;
      const right = Math.round(width * used / total);
      positions.push([left, top, right - left, rowHeight, 0, 1]);
      left = right;
    }
    top += rowHeight;
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
      state(width / 2, height * .5, coverWidth, coverWidth / coverAspect, 0, i === 0 ? 1 : 0),
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
