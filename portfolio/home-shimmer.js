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

if (statement && !editing && 'IntersectionObserver' in window && !reducedMotion.matches
  && typeof statement.animate === 'function') {
  const appearance = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .25)) return;
    appearance.disconnect();
    if (!reducedMotion.matches) writeStatement(statement);
  }, { threshold: .25 });
  appearance.observe(statement);
}

function writeStatement(element) {
  const text = element.textContent;
  const sentences = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)].map(part => part.segment)
    : text.match(/[^.!?]*[.!?]+\s*|[^.!?]+$/gu) ?? [text];
  const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
  const content = document.createDocumentFragment();
  const animations = [];
  let delay = 0;

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
  function finish() {
    reducedMotion.removeEventListener('change', reduce);
    for (const animation of writing) animation.cancel();
    // A late published edit may already have supplied different content.
    if (animations.length && element.contains(animations[0].mark)) element.textContent = text;
  }
  function reduce(event) {
    if (event.matches) finish();
  }
  reducedMotion.addEventListener('change', reduce);
  Promise.all(writing.map(animation => animation.finished)).then(finish, () => {});
}
