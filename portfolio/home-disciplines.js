export function measureDisciplines(hero, origin, leftEdge, rightEdge) {
  const source = hero.querySelector('.hero-subtitle');
  const node = source.firstChild;
  const css = getComputedStyle(source);
  const width = origin.width;
  const margin = Math.max(14, width * .05);
  const gap = width > 700 ? 24 : 10;
  const leftRoom = leftEdge - margin - gap;
  const rightRoom = width - margin - gap - rightEdge;
  const useLeft = leftRoom >= (width > 700 ? 165 : 105) || leftRoom > rightRoom;
  const available = Math.max(30, useLeft ? leftRoom : rightRoom);
  const left = useLeft ? margin : rightEdge + gap;
  const top = Math.round(origin.height * .42);
  const fontSize = parseFloat(css.fontSize);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
  const longestWord = Math.max(1, ...source.textContent.trim().split(/\s+/).map(word => measure.measureText(word).width));
  const scale = width > 700 ? 1 : Math.max(.58, Math.min(1, (available - 2) / longestWord));
  const layer = document.createElement('div');
  layer.className = 'scroll-disciplines';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    fontFamily: css.fontFamily, fontStyle: css.fontStyle, fontWeight: css.fontWeight,
    fontSize: css.fontSize, lineHeight: css.lineHeight, letterSpacing: css.letterSpacing,
    color: css.color, textTransform: css.textTransform, textShadow: css.textShadow,
  });

  let items = [];
  let cursor = top;
  if (node instanceof Text && css.display !== 'none') {
    const range = document.createRange();
    hero.append(layer);
    for (const match of node.data.matchAll(/[^·•|\n]+/g)) {
      const value = match[0].trim();
      if (!value) continue;
      const start = match.index + match[0].indexOf(value);
      range.setStart(node, start);
      range.setEnd(node, start + value.length);
      const box = range.getBoundingClientRect();
      if (!box.width) continue;
      const label = document.createElement('span');
      label.textContent = value;
      layer.append(label);
      label.style.width = `${available}px`;
      label.style.fontSize = `${fontSize * scale}px`;
      items.push({ label, x: box.left - origin.left, y: box.top - origin.top,
        width: box.width + 2, top: cursor });
      cursor += label.offsetHeight + (width > 700 ? 14 : 8);
    }
    if (!items.length) layer.remove();
  }

  return {
    instruction: { left, top: cursor + 16, width: available },
    draw(across, up) {
      if (!items.length) return;
      source.classList.add('scroll-disciplines-source');
      for (const item of items) {
        const interpolate = (a, b, amount = across) => a + (b - a) * amount;
        item.label.style.transform = `translate3d(${interpolate(item.x, left)}px, ${interpolate(item.y, item.top, up)}px, 0)`;
        item.label.style.width = `${interpolate(item.width, available)}px`;
        item.label.style.fontSize = `${interpolate(fontSize, fontSize * scale)}px`;
      }
    },
    reset() {
      source.classList.remove('scroll-disciplines-source');
      layer.remove();
      items = [];
    },
  };
}
