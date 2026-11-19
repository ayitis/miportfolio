import { alignNuptiasEditorial, applyNuptiasLayout } from './nuptias-layout.js';
import { applyHomeGalleryLayout } from './home-gallery-layout.js';
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
  const firstPaint = page === 'nuptias' ? window.nuptiasFirstPaint : null;
  const snapshot = firstPaint ? await firstPaint.snapshot : await loadPublished(page);
  if (!snapshot?.published) {
    if (page === 'nuptias') {
      const media = matchMedia('(max-width: 700px)');
      const renderDefault = () => {
        const view = media.matches ? 'mobile' : 'desktop';
        applyNuptiasLayout(document, { desktop: {}, mobile: {} }, view);
        alignNuptiasEditorial(document, view);
      };
      window.addEventListener('resize', renderDefault);
      renderDefault();
    }
    return;
  }
  const { request, published } = snapshot;

  const design = validateDraft(published.document, page);
  const mobile = matchMedia('(max-width: 700px)');
  const elements = collectElements(document, pages[page].targets);
  const gallery = page === 'nuptias' && collectGallery(document);
  const uploads = visibleUploads(design.gallery);
  let urls = new Map();
  syncCustomElements(document, elements, design);
  const render = () => {
    const view = mobile.matches ? 'mobile' : 'desktop';
    if (page === 'nuptias') applyNuptiasLayout(document, design, view);
    for (const id of elements.keys()) applyElement(elements, id, design, view);
    if (page === 'home') {
      applyHomeGalleryLayout(document, design[view]);
      document.dispatchEvent(new Event('portfolio:home-design'));
    }
    if (gallery) renderGallery(gallery, design.gallery, view, urls);
    if (page === 'nuptias') alignNuptiasEditorial(document, view);
  };
  async function loadPhotoUrls(signal) {
    return signGalleryPhotos((path, body) => request(path, { body, signal }), request.storageUrl, uploads);
  }

  if (gallery && uploads.length) {
    // Resolve the first visible gallery order before showing the page. In a
    // Storage failure, keep the saved layout and show repository images.
    try {
      urls = await loadPhotoUrls(firstPaint?.signal);
    } catch {
      // The rest of the published design is still available.
    }
  }

  window.addEventListener('resize', render);
  render();

  if (gallery && uploads.length) {
    async function updatePhotos() {
      try {
        urls = await loadPhotoUrls();
        renderGallery(gallery, design.gallery, mobile.matches ? 'mobile' : 'desktop', urls);
      } catch {
        // Preserve the gallery's repository photos if Storage is unavailable.
      }
    }
    setInterval(updatePhotos, (photoLinkLifetime - 60) * 1000);
  }
}

async function loadPublished(page) {
  const request = await connect();
  const [published] = await request(`/rest/v1/portfolio_published?page=eq.${page}&select=document`);
  return { request, published };
}

showPublishedDesign().catch(() => {
  // The original page remains usable when data or configuration is unavailable.
}).finally(() => window.nuptiasFirstPaint?.done());
