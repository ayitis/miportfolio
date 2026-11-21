// Keep the CSS marquee moving at all times. The Web Animations playback rate
// changes continuously on hover, without restarting or seeking the timeline.
const marquee = document.querySelector('.marquee');
const track = marquee?.querySelector('.marquee-track');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const editor = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');

if (marquee && track && !editor) {
  let hovered = false;
  let frame = 0;
  let currentRate = 1;
  let last = 0;
  const targetRate = () => hovered ? 0.32 : 1;
  const getTravel = () => track.getAnimations().find(animation => animation.animationName === 'travel');

  function easeRate(timestamp) {
    frame = 0;
    if (reduced.matches) return;
    const animation = getTravel();
    if (!animation) return;
    const dt = Math.min(64, timestamp - (last || timestamp));
    last = timestamp;
    const rate = targetRate();
    currentRate += (rate - currentRate) * (1 - Math.exp(-dt / 260));
    if (Math.abs(rate - currentRate) < .002) currentRate = rate;
    animation.updatePlaybackRate(currentRate);
    if (currentRate !== rate) frame = requestAnimationFrame(easeRate);
  }
  function transitionToRate() {
    if (frame) cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(easeRate);
  }
  marquee.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      hovered = true; transitionToRate();
    }
  });
  marquee.addEventListener('pointerleave', () => { hovered = false; transitionToRate(); });
  marquee.addEventListener('focusin', () => { hovered = true; transitionToRate(); });
  marquee.addEventListener('focusout', event => {
    if (!marquee.contains(event.relatedTarget)) { hovered = false; transitionToRate(); }
  });
  reduced.addEventListener('change', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; currentRate = 1;
    getTravel()?.updatePlaybackRate(1);
  });
}
