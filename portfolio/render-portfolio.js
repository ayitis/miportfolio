import { applyNuptiasLayout } from './nuptias-layout.js';
import { applyHomeGalleryLayout } from './home-gallery-layout.js';
import { applyElement, constrainNuptiasPositions } from './render-design.js';

export function renderPortfolio(page, elements, design, view, {
  renderGallery = () => {},
  renderHome = () => {
    applyHomeGalleryLayout(page, design[view]);
    page.dispatchEvent(new Event('portfolio:home-design'));
  },
} = {}) {
  if (design.page === 'nuptias') applyNuptiasLayout(page, design, view);
  for (const id of elements.keys()) applyElement(elements, id, design, view);
  renderGallery();
  constrainNuptiasPositions(page, elements, design, view);
  if (design.page === 'home') renderHome();
}
