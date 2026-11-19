import { validateDraft } from './design-document.js';
import { applyElement, collectElements } from './render-design.js';
import { pages } from './pages.js';
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
  const render = () => {
    const view = mobile.matches ? 'mobile' : 'desktop';
    for (const id of elements.keys()) applyElement(elements, id, design, view);
  };
  mobile.addEventListener('change', render);
  render();
}

showPublishedDesign().catch(() => {
  // The original page remains usable when data or configuration is unavailable.
});
