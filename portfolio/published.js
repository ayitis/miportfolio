import { ayamPage } from './ayam-document.js';
import { renderAyam, syncAyamNodes } from './ayam-layout.js';
import { carnagePage } from './carnage-document.js';
import { applyNuptiasLayout } from './nuptias-layout.js';
import { validateDraft } from './design-document.js';
import { collectElements, syncCustomElements } from './render-design.js';
import { portfolioView } from './viewport.js';
import { renderPortfolio } from './render-portfolio.js';
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
      const renderDefault = () => {
        const view = portfolioView(window, page);
        applyNuptiasLayout(document, { desktop: {}, mobile: {} }, view);
      };
      window.addEventListener('resize', renderDefault);
      renderDefault();
    }
    return;
  }
  const { request, published } = snapshot;

  const design = validateDraft(published.document, page);
  const elements = collectElements(document, pages[page].targets);
  const gallery = page === 'nuptias' && collectGallery(document);
  const uploads = visibleUploads(design.gallery);
  let urls = new Map();
  if (page === ayamPage) syncAyamNodes(document, design, elements);
  syncCustomElements(document, elements, design);
  const render = () => {
    const view = portfolioView(window, page);
    renderPortfolio(document, elements, design, view, {
      renderGallery: () => {
        if (page === carnagePage) {
          document.dispatchEvent(new CustomEvent('portfolio:carnage-design', { detail: { view, settings: design.carnage[view] } }));
        }
        if (page === ayamPage) renderAyam(document, design, view);
        if (gallery) renderGallery(gallery, design.gallery, view, urls);
      },
    });
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
        render();
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
