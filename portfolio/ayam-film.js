const frame = document.querySelector('#fashion-film');
const video = frame.querySelector('video');
const audioButton = frame.querySelector('.film-audio-toggle');
let start = 0;
let end;
let currentSource = video.querySelector('source').getAttribute('src');
let inView = false;

function interval() {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return [0, Infinity];
  const from = Math.min(start, Math.max(0, duration - .1));
  const fallback = duration > 7 ? duration - 7 : duration;
  return [from, Math.min(duration, Math.max(from + .1, end ?? fallback))];
}

function canPlay() {
  return inView && !document.hidden;
}

function play() {
  if (canPlay()) video.play().catch(() => {});
}

function syncVisibility() {
  if (canPlay()) play();
  else video.pause();
}

function loop() {
  video.currentTime = interval()[0];
  play();
}

function syncSoundButton() {
  audioButton.textContent = video.muted ? 'ACTIVAR SONIDO' : 'SILENCIAR';
  audioButton.setAttribute('aria-label', video.muted ? 'Activar sonido del fashion film' : 'Silenciar fashion film');
  audioButton.setAttribute('aria-pressed', String(!video.muted));
}

audioButton.addEventListener('click', () => {
  video.muted = !video.muted;
  syncSoundButton();
  // Called directly from a click: browsers permit audible playback here.
  play();
});
syncSoundButton();

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
video.addEventListener('error', () => frame.classList.remove('has-video'));
video.addEventListener('timeupdate', () => {
  const [from, to] = interval();
  if (video.currentTime < from || video.currentTime >= to) loop();
});
video.addEventListener('ended', loop);
document.addEventListener('portfolio:ayam-restart', loop);

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
