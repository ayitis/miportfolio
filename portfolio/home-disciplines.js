export function measureDisciplines(hero, origin, leftEdge) {
  const source = hero.querySelector('.hero-subtitle');
  const node = source.firstChild;
  const css = getComputedStyle(source);
  const width = origin.width;
  const footer = hero.querySelector('.hero-footer');
  const credit = footer.firstElementChild.getBoundingClientRect();
  const anchor = credit.height ? credit : footer.getBoundingClientRect();
  const narrow = width <= 700;
  const gap = narrow ? 6 : 9;
  const leading = narrow ? 5 : 14;
  const creditLeft = anchor.left - origin.left;
  const left = leftEdge - creditLeft < 85 ? Math.max(3, creditLeft * .35) : creditLeft;
  const available = Math.max(12, leftEdge - left - (narrow ? 5 : 24));
  const fontSize = parseFloat(css.fontSize);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
  const longestWord = Math.max(1, ...source.textContent.trim().split(/\s+/).map(word => measure.measureText(word).width));
  const scale = Math.max(narrow ? .64 : .72, Math.min(1, (available - 2) / longestWord));
  const lineHeight = parseFloat(css.lineHeight) || fontSize * 1.2;
  const layer = document.createElement('div');
  layer.className = 'scroll-disciplines';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    fontFamily: css.fontFamily, fontStyle: css.fontStyle, fontWeight: css.fontWeight,
    fontSize: css.fontSize, lineHeight: css.lineHeight, letterSpacing: css.letterSpacing,
    color: css.color, textTransform: css.textTransform, textShadow: css.textShadow,
  });

  let items = [];
  let cursor = 0;
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
      label.style.lineHeight = `${lineHeight * scale}px`;
      items.push({ label, x: box.left - origin.left, y: box.top - origin.top,
        width: box.width + 2, top: cursor });
      cursor += label.getBoundingClientRect().height + leading;
    }
    if (!items.length) layer.remove();
    else {
      const top = anchor.top - origin.top - gap - (cursor - leading);
      for (const item of items) item.top += top;
    }
  }

  return {
    draw(across, up) {
      if (!items.length) return;
      source.classList.add('scroll-disciplines-source');
      for (const item of items) {
        const interpolate = (a, b, amount = across) => a + (b - a) * amount;
        item.label.style.transform = `translate3d(${interpolate(item.x, left)}px, ${interpolate(item.y, item.top, up)}px, 0)`;
        item.label.style.width = `${interpolate(item.width, available)}px`;
        item.label.style.fontSize = `${interpolate(fontSize, fontSize * scale)}px`;
        item.label.style.lineHeight = `${interpolate(lineHeight, lineHeight * scale)}px`;
      }
    },
    reset() {
      source.classList.remove('scroll-disciplines-source');
      layer.remove();
      items = [];
    },
  };
}
