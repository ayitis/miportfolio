const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (!editing && !reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (reducedMotion.matches) continue;
      target.animate(
        [{ opacity: .45, transform: 'translateY(13px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      );
    }
  }, { threshold: .12 });

  for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
}
