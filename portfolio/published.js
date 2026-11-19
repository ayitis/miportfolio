import { validateDraft } from './design-document.js';
import { applyElement, collectElements, syncCustomElements } from './render-design.js';
import { pages } from './pages.js';
import { visibleUploads } from './gallery-document.js';
import { signGalleryPhotos, photoLinkLifetime } from './gallery-storage.js';
import { collectGallery, renderGallery } from './render-gallery.js';
import { connect } from './supabase.js';

async function showPublishedDesign() {
  // The editor renders its own draft on the original HTML inside the frame.
  if (window.parent !== window && new URLSearchParams(location.search).has('editor-preview')) return;

  const page = document.documentElement.dataset.designPage ?? 'home';
  if (!Object.hasOwn(pages, page)) return;
  const request = await connect();
  const [published] = await request(`/rest/v1/portfolio_published?page=eq.${page}&select=document`);
  if (!published) return;

  const design = validateDraft(published.document, page);
  const mobile = matchMedia('(max-width: 700px)');
  const elements = collectElements(document, pages[page].targets);
  const gallery = page === 'nuptias' && collectGallery(document);
  const uploads = visibleUploads(design.gallery);
  let urls = new Map();
  syncCustomElements(document, elements, design);
  const render = () => {
    const view = mobile.matches ? 'mobile' : 'desktop';
    for (const id of elements.keys()) applyElement(elements, id, design, view);
    if (gallery) renderGallery(gallery, design.gallery, view, urls);
  };
  window.addEventListener('resize', render);
  render();

  if (gallery && uploads.length) {
    async function updatePhotos() {
      try {
        urls = await signGalleryPhotos((path, body) => request(path, { body }), request.storageUrl, uploads);
        renderGallery(gallery, design.gallery, mobile.matches ? 'mobile' : 'desktop', urls);
      } catch {
        // Preserve the gallery's repository photos if Storage is unavailable.
      }
    }
    await updatePhotos();
    setInterval(updatePhotos, (photoLinkLifetime - 60) * 1000);
  }
}

showPublishedDesign().catch(() => {
  // The original page remains usable when data or configuration is unavailable.
});
