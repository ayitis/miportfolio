import { validateDraft } from './design-document.js';

// Use the same anonymous read for visitors and post-publication verification.
export async function readPublishedDocument(request, page) {
  const [row] = await request(`/rest/v1/portfolio_published?page=eq.${encodeURIComponent(page)}&select=document,revision`);
  if (!row) return null;
  return { document: validateDraft(row.document, page), revision: row.revision };
}
