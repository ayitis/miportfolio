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
}
