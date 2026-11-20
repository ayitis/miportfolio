const feed = document.querySelector('.social-feed');
const strip = feed.querySelector('.social-strip');
const section = feed.closest('.social-action');
const desktopMotion = matchMedia('(width > 760px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');

if (!editing) {
  const track = document.createElement('div');
  track.className = 'social-track';
  strip.replaceWith(track);
  track.append(strip);

  let motion;
  let viewportVisible = false;
  let frame;
  let clones = [];
  function playback() {
    if (!motion) return;
    if (viewportVisible && !document.hidden && !feed.matches(':hover, :focus-within')) motion.play();
    else motion.pause();
  }

  function build() {
    frame = undefined;
    const progress = motion?.effect.getComputedTiming().progress ?? 0;
    motion?.cancel();
    motion = undefined;
    clones.forEach(clone => clone.remove());
    clones = [];
    delete feed.dataset.looping;
    const visiblePosts = [...strip.children].filter(post => !post.hidden && post.getClientRects().length);
    if (!desktopMotion.matches || !visiblePosts.length || !feed.clientWidth) return;
    const length = parseFloat(getComputedStyle(strip).width);
    if (!length) return;
    const copies = Math.ceil(feed.clientWidth / length) + 1;
    for (let i = 0; i < copies; i++) {
      const clone = strip.cloneNode(true);
      clone.inert = true;
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('[data-villa-image]').forEach(post => post.removeAttribute('data-villa-image'));
      track.append(clone);
      clones.push(clone);
    }
    feed.scrollLeft = 0;
    feed.dataset.looping = '';
    const duration = 1000 * Number(getComputedStyle(section).getPropertyValue('--social-seconds'));
    // Move from the right side of the phone outward: every card travels left-to-right.
    // The repeated strips keep the motion seamless across loop boundaries.
    motion = track.animate([{ transform: `translateX(-${length}px)` }, { transform: 'translateX(0)' }], {
      duration, iterations: Infinity, easing: 'linear',
    });
    motion.currentTime = progress * duration;
    playback();
  }

  function schedule() {
    frame ??= requestAnimationFrame(build);
  }

  const sizes = new ResizeObserver(schedule);
  sizes.observe(feed);
  sizes.observe(strip);
  const changes = new MutationObserver(schedule);
  changes.observe(section, { attributes: true, attributeFilter: ['style', 'hidden'] });
  changes.observe(strip, { subtree: true, attributes: true, attributeFilter: ['style', 'src', 'hidden'] });
  new IntersectionObserver(([entry]) => {
    viewportVisible = entry.isIntersecting;
    playback();
  }).observe(feed);
  desktopMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', playback);
  for (const event of ['mouseenter', 'mouseleave', 'focusin', 'focusout']) feed.addEventListener(event, () => requestAnimationFrame(playback));
  schedule();
}
