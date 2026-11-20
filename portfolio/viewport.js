// Keep the document selection and editor's permitted canvas widths in sync.
export function mobileMaxWidth(page) {
  if (page === 'villa-tiger') return 760;
  if (page === 'ayam') return 800;
  if (page === 'maison-carnage') return 650;
  return 700;
}

export function portfolioView(win, page) {
  return win.matchMedia(`(max-width: ${mobileMaxWidth(page)}px)`).matches ? 'mobile' : 'desktop';
}
