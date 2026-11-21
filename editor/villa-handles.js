const handles = [
  ['nw', 'superior izquierda'], ['n', 'superior'], ['ne', 'superior derecha'],
  ['w', 'izquierda'], ['e', 'derecha'],
  ['sw', 'inferior izquierda'], ['s', 'inferior'], ['se', 'inferior derecha'],
];

export function attachVillaHandles(page) {
  const sketch = page.querySelector('.villa-sketch');
  const identity = page.querySelector('#identity');
  for (const [edge, label] of handles) {
    const handle = page.createElement('span');
    handle.dataset.villaHandle = edge;
    handle.title = `Redimensionar desde ${label}`;
    sketch.append(handle);
  }
  const handle = page.createElement('span');
  handle.dataset.villaHandle = 'section';
  handle.textContent = 'Arrastra para ajustar la separación';
  identity.append(handle);

  const style = page.createElement('style');
  style.textContent = `
    #identity { position: relative; }
    [data-villa-handle] { position: absolute; z-index: 20; touch-action: none; user-select: none; }
    .villa-sketch [data-villa-handle] {
      display: none; width: 15px; height: 15px; background: #fff;
      border: 2px solid #7945be; border-radius: 2px;
    }
    .villa-sketch[data-editor-selected] [data-villa-handle] { display: block; }
    [data-villa-handle^="n"] { top: 0; }
    [data-villa-handle^="s"] { bottom: 0; }
    [data-villa-handle$="w"] { left: 0; }
    [data-villa-handle$="e"] { right: 0; }
    [data-villa-handle="n"], [data-villa-handle="s"] { left: calc(50% - 7px); cursor: ns-resize; }
    [data-villa-handle="w"], [data-villa-handle="e"] { top: calc(50% - 7px); cursor: ew-resize; }
    [data-villa-handle="nw"], [data-villa-handle="se"] { cursor: nwse-resize; }
    [data-villa-handle="ne"], [data-villa-handle="sw"] { cursor: nesw-resize; }
    [data-villa-handle="section"] {
      top: 0; bottom: auto; left: 50%; translate: -50% 0; padding: 5px 10px; cursor: ns-resize;
      background: #fff; color: #43275d; border: 1px solid #a88ec7; border-radius: 0 0 5px 5px;
      max-width: 90%; text-align: center; font: 12px system-ui;
    }
  `;
  page.head.append(style);
}

export function resizeVillaSketch({ edge, width, height, locked }, dx, dy) {
  const horizontal = edge.includes('w') ? -1 : edge.includes('e') ? 1 : 0;
  const vertical = edge.includes('n') ? -1 : edge.includes('s') ? 1 : 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let nextWidth = clamp(width + horizontal * dx, 10, 4000);
  let nextHeight = clamp(height + vertical * dy, 16, 4000);
  if (locked) {
    const widthRatio = nextWidth / width;
    const heightRatio = nextHeight / height;
    const ratio = Math.abs(widthRatio - 1) >= Math.abs(heightRatio - 1) ? widthRatio : heightRatio;
    const scale = clamp(ratio, Math.max(10 / width, 16 / height), Math.min(4000 / width, 4000 / height));
    nextWidth = width * scale;
    nextHeight = height * scale;
  }
  return {
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
    // The grid centers the frame. Compensate to keep the opposite edge in place.
    x: horizontal * (nextWidth - width) / 2,
    y: vertical === -1 ? height - nextHeight : vertical === 0 ? (height - nextHeight) / 2 : 0,
  };
}
