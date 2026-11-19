import { targets as homeTargets } from './home-design.js';

export const pages = {
  home: { label: 'Home / Portada', path: '/index.html', targets: homeTargets },
  nuptias: {
    label: 'NUPTIAS',
    path: '/nuptias.html',
    targets: [
      ['nav.home', 'Menú · Volver a la portada', 'header .links a[href="./index.html"]'],
      ['nav.work', 'Menú · Work', 'header .links a[href="./index.html#work"]'],
      ['category.number', 'Categoría · Editorial', '.category span:first-child'],
      ['category.photography', 'Categoría · Fotografía', '.category span:last-child'],
      ['editorial.eyebrow', 'Editorial · Antetítulo', '.eyebrow'],
      ['editorial.title', 'Editorial · NUPTIAS', '#title'],
      ['editorial.credit', 'Editorial · Impuribus', '.credit'],
      ['editorial.roles', 'Editorial · Créditos', '.roles'],
      ['concept.title', 'Concepto · Título completo', '.concept h2', { text: false }],
      ['concept.form', 'Concepto · FORM', '[data-design-part="form"]', { inline: true }],
      ['concept.ampersand', 'Concepto · &', '.concept h2 em', { inline: true }],
      ['concept.feeling', 'Concepto · FEELING.', '[data-design-part="feeling"]', { inline: true }],
      ['concept.description', 'Concepto · Descripción', '.concept p'],
      ['footer.copyright', 'Pie · Créditos', 'footer span:first-child'],
      ['footer.motion', 'Pie · Images in motion', 'footer span:last-child'],
    ],
  },
};
