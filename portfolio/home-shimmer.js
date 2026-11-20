const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(hover: none)');
const cards = [...document.querySelectorAll('.gallery-wrap .project')];

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      target.toggleAttribute('data-shimmer-visible', intersectionRatio >= .35);
    }
  }, { threshold: .35 });

  function observe() {
    observer.disconnect();
    for (const target of cards) target.removeAttribute('data-shimmer-visible');
    if (reducedMotion.matches) return;
    if (touch.matches) cards.forEach(card => observer.observe(card));
  }

  reducedMotion.addEventListener('change', observe);
  touch.addEventListener('change', observe);
  observe();
}

const statement = document.querySelector('.about .closing-statement');
const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');

// The sentence animation is replayed on every downward re-entry.
// Keep the observer connected; resetting it when the text leaves the viewport
// allows any number of replays without refreshing the page.
if (statement && !editing && 'IntersectionObserver' in window
  && typeof statement.animate === 'function') {
  let armed = true;
  let running = null;
  let previousY = window.scrollY;
  let direction = 0;

  function syncDirection() {
    const now = window.scrollY;
    const difference = now - previousY;
    if (Math.abs(difference) >= 2) direction = Math.sign(difference);
    previousY = now;
  }
  window.addEventListener('scroll', syncDirection, { passive: true });

  function stopWriting() {
    if (!running) return;
    running.cancel();
    running = null;
  }

  const appearance = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target !== statement) continue;
      if (!entry.isIntersecting || entry.intersectionRatio < .08) {
        // Fully away from the sentence: prepare the next downward scroll.
        armed = true;
        stopWriting();
      } else if (entry.intersectionRatio >= .25 && armed && direction >= 0) {
        armed = false;
        if (!reducedMotion.matches) running = writeStatement(statement, () => {
          running = null;
        });
      }
    }
  }, { threshold: [0, .08, .25, .5] });

  appearance.observe(statement);

  reducedMotion.addEventListener('change', event => {
    if (event.matches) stopWriting();
  });
}

function writeStatement(element, onFinish) {
  const text = element.textContent;
  const sentences = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)].map(part => part.segment)
    : text.match(/[^.!?]*[.!?]+\s*|[^.!?]+$/gu) ?? [text];
  const graphemes = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const content = document.createDocumentFragment();
  const animations = [];
  let delay = 0;
  let cancelled = false;

  for (const sentence of sentences) {
    const letters = graphemes ? [...graphemes.segment(sentence)].map(part => part.segment) : [...sentence];
    for (const letter of letters) {
      if (/^\s+$/u.test(letter)) {
        content.append(letter);
        continue;
      }
      const mark = document.createElement('span');
      mark.textContent = letter;
      content.append(mark);
      animations.push({ mark, delay });
      delay += 32;
    }
    delay += 280;
  }

  element.replaceChildren(content);
  const writing = animations.map(({ mark, delay }) =>
    mark.animate([{ opacity: 0 }, { opacity: 1 }], { delay, duration: 90, fill: 'backwards' }));

  function restore() {
    for (const animation of writing) animation.cancel();
    // Preserve user edits applied during animation.
    if (animations.length && element.contains(animations[0].mark)) element.textContent = text;
  }

  Promise.all(writing.map(animation => animation.finished)).then(() => {
    if (cancelled) return;
    restore();
    onFinish();
  }, () => {});

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      restore();
    },
  };
}
