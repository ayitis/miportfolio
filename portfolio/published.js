import { ayamPage } from './ayam-document.js';
import { renderAyam, renderIreSettings, renderNotEgo, syncAyamNodes } from './ayam-layout.js';
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

const isEditorPreview = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');

async function showPublishedDesign() {
  // The editor renders its own draft on the original HTML inside the frame.
  if (isEditorPreview) return;

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
        if (page === ayamPage) {
          renderAyam(document, design, view);
          renderNotEgo(document, design, view);
          renderIreSettings(document, design, view);
        }
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

showPublishedDesign().catch((error) => {
  // Never hide a failed publish read as if the site were displaying the saved design.
  console.error('[Portfolio] Failed to load or render published design:', error);
  if (document.documentElement.dataset.designPage === 'villa-tiger') {
    const warning = document.createElement('div');
    warning.setAttribute('role', 'alert');
    warning.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:99999;max-width:600px;margin:auto;padding:12px 16px;background:#fff8e9;color:#3a2517;border:1px solid #a5440d;box-shadow:0 4px 24px #0002;font:14px/1.45 Arial,sans-serif';
    warning.textContent = 'Villa Tiger: no se pudo cargar la versión publicada desde Supabase. Esta página puede mostrar el diseño original. Recarga e inténtalo de nuevo.';
    document.body.append(warning);
  }
}).finally(() => {
  window.nuptiasFirstPaint?.done();
  if (document.documentElement.dataset.designPage === ayamPage && !isEditorPreview) {
    import('./ayam-reveal.js').then(({ startAyamReveals }) => startAyamReveals(document)).catch(() => {});
  }
});
