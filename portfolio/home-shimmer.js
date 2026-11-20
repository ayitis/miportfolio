const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(hover: none)');
const statement = document.querySelector('.about .closing-statement');
const cards = [...document.querySelectorAll('.gallery-wrap .project')];

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      target.toggleAttribute('data-shimmer-visible', intersectionRatio >= .35);
    }
  }, { threshold: .35 });

  function observe() {
    observer.disconnect();
    for (const target of [statement, ...cards]) target?.removeAttribute('data-shimmer-visible');
    if (reducedMotion.matches) return;
    if (statement) observer.observe(statement);
    if (touch.matches) cards.forEach(card => observer.observe(card));
  }

  reducedMotion.addEventListener('change', observe);
  touch.addEventListener('change', observe);
  observe();
}
