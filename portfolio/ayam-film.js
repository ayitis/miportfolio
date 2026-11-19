const frame = document.querySelector('#fashion-film');
const video = frame.querySelector('video');
let start = 0;
let end;
let currentSource = video.querySelector('source').getAttribute('src');
let inView = false;
let userInteracted = false;

function interval() {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return [0, Infinity];
  const from = Math.min(start, Math.max(0, duration - .1));
  const fallback = duration > 7 ? duration - 7 : duration;
  return [from, Math.min(duration, Math.max(from + .1, end ?? fallback))];
}

function shouldPlay() {
  return inView && !document.hidden;
}

function resume() {
  if (!shouldPlay()) return;
  // Try audible playback first. Autoplay policies may reject it until a
  // user gesture; in that case keep the moving picture visible, muted.
  if (userInteracted) video.muted = false;
  const attempt = video.play();
  if (attempt?.catch) attempt.catch(() => {
    if (!shouldPlay()) return;
    video.muted = true;
    video.play().catch(() => {});
  });
}

function syncVisibility() {
  if (!shouldPlay()) video.pause();
  else resume();
}

function restartLoop() {
  video.currentTime = interval()[0];
  resume();
}

function activateAudio() {
  userInteracted = true;
  if (!shouldPlay()) return;
  video.muted = false;
  resume();
}
// Browsers normally allow unmuting only as a result of a real interaction.
// No sound/pause controls are added to the interface.
document.addEventListener('pointerdown', activateAudio, { capture: true, passive: true });
document.addEventListener('keydown', activateAudio, { capture: true });

const visibility = new IntersectionObserver(([entry]) => {
  inView = entry.intersectionRatio >= .2;
  syncVisibility();
}, { threshold: [0, .2] });
visibility.observe(frame);
document.addEventListener('visibilitychange', syncVisibility);

video.addEventListener('loadedmetadata', () => {
  const [from, to] = interval();
  if (video.currentTime < from || video.currentTime >= to) video.currentTime = from;
  syncVisibility();
});
video.addEventListener('loadeddata', () => frame.classList.add('has-video'));
video.addEventListener('playing', () => frame.classList.add('has-video'));
video.addEventListener('error', () => frame.classList.remove('has-video'));
video.addEventListener('timeupdate', () => {
  const [from, to] = interval();
  if (video.currentTime < from || video.currentTime >= to) restartLoop();
});
video.addEventListener('ended', restartLoop);
document.addEventListener('portfolio:ayam-restart', restartLoop);
document.addEventListener('portfolio:ayam-film', ({ detail }) => {
  const { source, start: nextStart = 0, end: nextEnd } = detail;
  const trimChanged = nextStart !== start || nextEnd !== end;
  start = nextStart;
  end = nextEnd;
  if (source !== currentSource) {
    currentSource = source;
    frame.classList.remove('has-video');
    video.src = source;
    video.load();
  } else if (trimChanged && video.readyState >= 1) {
    const [from, to] = interval();
    if (video.currentTime < from || video.currentTime >= to) video.currentTime = from;
  }
});
// A muted video can start reliably even on browsers that block audio.
video.muted = false;
syncVisibility();
