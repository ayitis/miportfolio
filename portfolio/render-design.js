import { fonts } from './design-document.js';

const properties = ['translate', 'font-size', 'font-family', 'text-align', 'width', 'white-space', 'color', 'display'];

export function collectElements(page, targets) {
  const elements = new Map();
  for (const [id, , selector, options] of targets) {
    const originals = [...page.querySelectorAll(selector)].map((node) => ({
      node,
      allowText: options?.text !== false,
      inline: options?.inline === true,
      children: [...node.childNodes],
      text: node.innerText.trim() || node.textContent,
      title: node.getAttribute('data-title'),
      styles: Object.fromEntries(properties.map((property) => [property, originalStyle(node, property)])),
    }));
    if (originals.length) elements.set(id, originals);
  }
  return elements;
}

function originalStyle(node, property) {
  return [node.style.getPropertyValue(property), node.style.getPropertyPriority(property)];
}

export function applyElement(editable, id, draft, view) {
  const overrides = draft[view][id] ?? {};
  const content = draft.content[id]?.text;
  const styles = {
    translate: overrides.x !== undefined || overrides.y !== undefined
      ? `${overrides.x ?? 0}px ${overrides.y ?? 0}px` : null,
    'font-size': overrides.size === undefined ? null : `${overrides.size}px`,
    'font-family': fonts[overrides.font] ?? null,
    'text-align': overrides.align ?? null,
    color: overrides.color ?? null,
    width: overrides.width === undefined ? null : `${overrides.width}px`,
    'white-space': content?.includes('\n') ? 'pre-line' : null,
  };

  for (const original of editable.get(id) ?? []) {
    const { node } = original;
    const display = original.inline && (styles.translate || styles.width || styles['text-align'])
      ? 'inline-block' : null;
    for (const [property, value] of Object.entries({ ...styles, display })) {
      if (value === null) node.style.setProperty(property, ...original.styles[property]);
      else node.style.setProperty(property, value);
    }
    if (original.allowText && original.appliedText !== content) {
      if (content === undefined) node.replaceChildren(...original.children);
      else node.textContent = content;
      if (original.title !== null) node.dataset.title = content ?? original.title;
      original.appliedText = content;
    }
  }
}
