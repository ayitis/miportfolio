const frame = document.querySelector('#fashion-film');
const video = frame.querySelector('video');
let start = 0;
let end;
let currentSource = video.querySelector('source').getAttribute('src');

function interval() {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return [0, Infinity];
  const from = Math.min(start, Math.max(0, duration - .1));
  const fallback = duration > 7 ? duration - 7 : duration;
  return [from, Math.min(duration, Math.max(from + .1, end ?? fallback))];
}

function play() {
  video.play().catch(() => {});
}

function loop() {
  video.currentTime = interval()[0];
  if (video.paused) play();
}

video.addEventListener('loadedmetadata', loop);
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
    play();
  } else if (trimChanged && video.readyState >= 1) loop();
});

if (video.readyState >= 1) loop();
else play();
