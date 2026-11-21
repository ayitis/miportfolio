export const horizontalGallery = 'gallery.rail';
export const verticalGallery = 'gallery.column';
export const verticalStage = 48;

export function applyHomeGalleryLayout(page, settings) {
  const hero = page.querySelector('.hero');
  if (!hero) return;
  const rail = settings[horizontalGallery];
  const column = settings[verticalGallery];
  hero.querySelector('.marquee').style.translate = rail ? `${rail.x ?? 0}px ${rail.y ?? 0}px` : '';
  hero.dataset.columnOffset = column?.x ?? 0;
  hero.dataset.columnOffsetY = column?.y ?? 0;
  // These offsets only affect text while the mobile scroll transition is active.
  // They are separate from the cover's normal text positions.
  const scrollTitle = settings['gallery.scroll-title'] ?? {};
  const scrollInstructions = settings['gallery.scroll-instructions'] ?? {};
  hero.style.setProperty('--mobile-scroll-title-x', `${scrollTitle.x ?? 0}px`);
  hero.style.setProperty('--mobile-scroll-title-y', `${scrollTitle.y ?? 0}px`);
  hero.style.setProperty('--mobile-scroll-instructions-x', `${scrollInstructions.x ?? 0}px`);
  hero.style.setProperty('--mobile-scroll-instructions-y', `${scrollInstructions.y ?? 0}px`);
}
