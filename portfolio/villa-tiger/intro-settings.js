import { villaImagePath } from '../villa-design.js';

export const introScenes = ['garden', 'olive', 'pool'];
export const introAsset = scene => `/portfolio/villa-tiger/intro-${scene}.png`;
export const introDuration = [250, 2500];
export const introLogoSize = [12, 72];

export function readVillaIntro(design, view) {
  const settings = design?.villaIntro?.[view];
  return {
    scenes: (settings?.order ?? introScenes).map(scene => ({
      scene, src: design?.villaIntro?.sources?.[scene] ?? introAsset(scene),
    })),
    transition: settings?.transition ?? 650,
    logoSize: settings?.logoSize ?? (view === 'mobile' ? 47 : 20),
  };
}

export function validateVillaIntro(value) {
  const validObject = item => item && typeof item === 'object' && !Array.isArray(item);
  const fail = () => { throw new Error('La portada de Villa Tiger contiene un ajuste inválido.'); };
  if (!validObject(value)) fail();
  const clean = {};
  for (const [view, settings] of Object.entries(value)) {
    if (!validObject(settings)) fail();
    if (view === 'sources') {
      clean.sources = {};
      for (const [scene, source] of Object.entries(settings)) {
        if (!introScenes.includes(scene) || !villaImagePath(source)) fail();
        clean.sources[scene] = source;
      }
      continue;
    }
    if (view !== 'desktop' && view !== 'mobile') fail();
    clean[view] = {};
    for (const [key, setting] of Object.entries(settings)) {
      if (key === 'order') {
        if (!Array.isArray(setting) || setting.length !== introScenes.length
          || new Set(setting).size !== introScenes.length || !setting.every(scene => introScenes.includes(scene))) fail();
        clean[view].order = [...setting];
        continue;
      }
      const range = key === 'transition' ? introDuration : key === 'logoSize' ? introLogoSize : null;
      if (!range || !Number.isInteger(setting) || setting < range[0] || setting > range[1]) fail();
      clean[view][key] = setting;
    }
  }
  return clean;
}
