const feed = document.querySelector('.social-feed');
const strip = feed.querySelector('.social-strip');
const section = feed.closest('.social-action');
const desktopMotion = matchMedia('(prefers-reduced-motion: no-preference)');
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
    if (viewportVisible && !document.hidden) motion.play();
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
  schedule();
}


/* Separate Instagram-story carousel. Placeholder cards remain still; real 9:16
   story assets will auto-scroll once inserted into .social-stories-strip. */
const storiesFeed = document.querySelector('.social-stories-feed');
if (storiesFeed && !editing) {
  const storyStrip = storiesFeed.querySelector('.social-stories-strip');
  const storyMediaQuery = matchMedia('(prefers-reduced-motion: no-preference)');
  let storyTrack;
  let storyAnimation;
  let storyClones = [];
  let storyVisible = false;
  let storyScheduled = false;

  const storyPlayback = () => {
    if (!storyAnimation) return;
    if (storyVisible && !document.hidden) {
      storyAnimation.play();
    } else storyAnimation.pause();
  };

  function rebuildStories() {
    storyScheduled = false;
    storyAnimation?.cancel();
    storyAnimation = undefined;
    for (const clone of storyClones) clone.remove();
    storyClones = [];
    delete storiesFeed.dataset.looping;
    // No animation until actual story images/videos are available.
    if (!storyMediaQuery.matches || !storyStrip.querySelector('.social-story') || !storiesFeed.clientWidth) return;
    const distance = storyStrip.getBoundingClientRect().width;
    if (!distance) return;
    const copies = Math.ceil(storiesFeed.clientWidth / distance) + 1;
    for (let i = 0; i < copies; i++) {
      const clone = storyStrip.cloneNode(true);
      clone.inert = true;
      clone.setAttribute('aria-hidden', 'true');
      storyTrack.append(clone);
      storyClones.push(clone);
    }
    storiesFeed.dataset.looping = '';
    storiesFeed.scrollLeft = 0;
    storyAnimation = storyTrack.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(-${distance}px)` }],
      { duration: 39000, iterations: Infinity, easing: 'linear' },
    );
    storyPlayback();
  }

  function scheduleStories() {
    if (storyScheduled) return;
    storyScheduled = true;
    requestAnimationFrame(rebuildStories);
  }

  storyTrack = document.createElement('div');
  storyTrack.className = 'social-stories-track';
  storyStrip.replaceWith(storyTrack);
  storyTrack.append(storyStrip);
  new ResizeObserver(scheduleStories).observe(storiesFeed);
  new ResizeObserver(scheduleStories).observe(storyStrip);
  new IntersectionObserver(([entry]) => {
    storyVisible = entry.isIntersecting;
    storyPlayback();
  }).observe(storiesFeed);
  storyMediaQuery.addEventListener('change', scheduleStories);
  document.addEventListener('visibilitychange', storyPlayback);
  scheduleStories();
}
