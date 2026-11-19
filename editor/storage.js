import { emptyDraft, validateDraft } from '../portfolio/design-document.js';
import { signGalleryPhotos } from '../portfolio/gallery-storage.js';
import { galleryBucket, uploadPath } from '../portfolio/gallery-document.js';
import { connect } from '../portfolio/supabase.js';

const sessionKey = 'miportfolio.editor.session.v1';

export async function openEditor() {
  const request = await connect();
  let session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
  let refresh;

  function setSession(next) {
    session = next;
    if (next) sessionStorage.setItem(sessionKey, JSON.stringify(next));
    else sessionStorage.removeItem(sessionKey);
  }

  function remember({ access_token, refresh_token, expires_in }) {
    setSession({ access_token, refresh_token, expires_at: Date.now() + expires_in * 1000 });
  }

  async function authorized(path, body, file) {
    if (!session) throw new Error('Inicia sesión para continuar.');
    if (session.expires_at - Date.now() < 60000) {
      refresh ??= request('/auth/v1/token?grant_type=refresh_token', {
        body: { refresh_token: session.refresh_token },
      }).then(remember).catch((error) => {
        if (error.status === 400 || error.status === 401) {
          setSession(null);
          throw new Error('La sesión ha caducado. Descarga una copia de tus cambios y vuelve a iniciar sesión.');
        }
        throw error;
      }).finally(() => { refresh = undefined; });
      await refresh;
    }
    return request(path, {
      token: session.access_token, body, file,
      ...(file && { signal: AbortSignal.timeout(120000) }),
    });
  }

  return {
    get signedIn() { return Boolean(session); },
    async signIn(email, password) {
      try {
        remember(await request('/auth/v1/token?grant_type=password', { body: { email, password } }));
      } catch (error) {
        if (error.status === 400 || error.status === 401) throw new Error('Revisa tu correo y contraseña.');
        throw error;
      }
    },
    async signOut() {
      try {
        if (session) await authorized('/auth/v1/logout?scope=local', {});
      } finally {
        setSession(null);
      }
    },
    async verifyOwner() {
      if (await authorized('/rest/v1/rpc/portfolio_is_owner', {}) !== true) {
        await this.signOut().catch(() => {});
        throw new Error('Esta cuenta no tiene acceso al editor.');
      }
    },
    async load(page) {
      const [saved] = await authorized(`/rest/v1/portfolio_drafts?page=eq.${page}&select=document,revision`);
      return saved ? { draft: validateDraft(saved.document, page), revision: saved.revision }
        : { draft: emptyDraft(page), revision: null };
    },
    async uploadPhoto(id, file) {
      await authorized(`/storage/v1/object/${galleryBucket}/${uploadPath(id)}`, undefined, file);
    },
    async photoUrls(ids) {
      return signGalleryPhotos(authorized, request.storageUrl, ids);
    },
    async save(draft, revision, publish) {
      const home = draft.page === 'home';
      return authorized(`/rest/v1/rpc/${home ? 'portfolio_save_home' : 'portfolio_save_page'}`, {
        ...(!home && { page_key: draft.page }),
        design: validateDraft(draft),
        expected_revision: revision,
        publish_now: publish,
      });
    },
    async history(page, before) {
      const cursor = before === undefined ? '' : `&revision=lt.${before}`;
      return authorized(`/rest/v1/portfolio_history?page=eq.${page}&select=revision,published,created_at&order=revision.desc&limit=20${cursor}`);
    },
    async restore(page, revision) {
      const [entry] = await authorized(`/rest/v1/portfolio_history?page=eq.${page}&revision=eq.${revision}&select=document`);
      if (!entry) throw new Error('No se encontró esta versión.');
      return validateDraft(entry.document, page);
    },
  };
}
