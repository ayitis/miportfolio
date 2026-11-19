// Keep these keys stable when changing the HTML. Both copies of each carousel
// card share a key, so the same change appears throughout the animation.
export const targets = [
  ['brand.latin', 'Marca · latín', '.brand-text'],
  ['brand.arabic', 'Marca · árabe (ajuste anterior)', '.brand-arabic', { showWhenEdited: true }],
  ['nav.work', 'Menú · Work', '.menu a[href="#work"]'],
  ['nav.about', 'Menú · About', '.menu a[href="#about"]'],
  ['nav.contact', 'Menú · Contact', '.menu a[href^="mailto:"]'],
  ['hero.title', 'Título principal', '.heading h1'],
  ['hero.subtitle', 'Subtítulo', '.hero-subtitle'],
  ['gallery.title', 'Carrusel · encabezado', '.gallery-header span:first-child'],
  ['gallery.instructions', 'Carrusel · indicaciones', '.gallery-header span:last-child'],
  ['hero.location', 'Portada · ubicación', '.hero-footer span:first-child'],
  ['hero.scroll', 'Portada · indicación de desplazamiento', '.hero-footer span:last-child'],
  ['about.title', 'Sobre mí · título', '.about h2'],
  ['about.description', 'Sobre mí · descripción', '.about .copy p'],
  ['about.behance', 'Sobre mí · Behance', '.about a[href*="behance.net"]'],
  ['about.instagram', 'Sobre mí · Instagram', '.about a[href*="instagram.com"]'],
  ['about.email', 'Sobre mí · correo', '.about a[href^="mailto:"]'],
  ['footer.copyright', 'Pie · créditos', 'footer span'],
  ['footer.top', 'Pie · volver arriba', 'footer a[href="#home"]'],
];

for (const [project, name, href] of [
  ['nuptias', 'NUPTIAS', 'nuptias.html'],
  ['carnage', 'Maison Carnage', 'project.html?name=carnage'],
  ['ayam', 'AYAM Studio', 'project.html?name=ayam'],
  ['ire', 'IRE Magazine', 'project.html?name=ire'],
  ['yves', 'Yves Rocher', 'project.html?name=yves'],
  ['villa', 'Villa Tiger', 'project.html?name=villa'],
]) {
  const card = `.project[href="${href}"] .card-info`;
  targets.push(
    [`card.${project}.number`, `${name} · número`, `${card} .no`],
    [`card.${project}.title`, `${name} · título`, `${card} strong`],
    [`card.${project}.description`, `${name} · categoría`, `${card} small`],
    [`card.${project}.arrow`, `${name} · flecha`, `${card} .arrow`],
  );
}
