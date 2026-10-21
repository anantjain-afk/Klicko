import { MAX_ELEMENTS, type ObservedElement } from '../../lib/messages';

const CONTROL_SELECTOR = [
  'button', 'a[href]', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]',
  '[role="radio"]', '[role="tab"]', '[role="menuitem"]',
  '[role="switch"]', '[role="combobox"]',
].join(', ');

const ALLOWED_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch', 'combobox', 'textbox',
]);

function safeLabel(text: string | null): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(normalized)) return '';
  if (/(?:\d[ -]?){12,}/.test(normalized)) return '';
  if (/\b(?:AIza[\w-]+|sk-[\w-]+)\b/.test(normalized)) return '';
  return normalized.slice(0, 80);
}

function safeText(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let length = 0;

  while (walker.nextNode() && length < 160) {
    const parent = walker.currentNode.parentElement;
    if (!parent || parent.closest('[contenteditable], [hidden], [aria-hidden="true"], input, textarea, select, script, style')) continue;
    let hiddenByStyle = false;
    for (let current: Element | null = parent; current; current = current.parentElement) {
      const style = parent.ownerDocument.defaultView?.getComputedStyle(current);
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') {
        hiddenByStyle = true;
        break;
      }
      if (current === element) break;
    }
    if (hiddenByStyle) continue;
    const text = walker.currentNode.textContent ?? '';
    parts.push(text);
    length += text.length;
  }

  return safeLabel(parts.join(' '));
}

function accessibleName(element: HTMLElement): string {
  const ariaLabel = safeLabel(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelIds = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
  const labelledBy = safeLabel(labelIds.map((id) => {
    const label = element.ownerDocument.getElementById(id);
    return label ? safeText(label) : '';
  }).join(' '));
  if (labelledBy) return labelledBy;

  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const label = element.labels?.[0];
    return label ? safeText(label) : safeLabel(element.getAttribute('title'));
  }

  return safeText(element) || safeLabel(element.getAttribute('title'));
}

function roleFor(element: HTMLElement): string {
  const explicitRole = element.getAttribute('role');
  if (explicitRole && ALLOWED_ROLES.has(explicitRole)) return explicitRole;
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return element.type;
    return 'textbox';
  }
  if (element instanceof HTMLTextAreaElement) return 'textbox';
  if (element instanceof HTMLSelectElement) return 'combobox';
  if (element.tagName === 'A') return 'link';
  return 'button';
}

function contextFor(element: HTMLElement): string {
  const landmark = element.closest('dialog, [role="dialog"], nav, [role="navigation"], header, main, aside, footer, form');
  if (!landmark) return '';
  const label = safeLabel(landmark.getAttribute('aria-label'));
  if (label) return label;
  if (landmark.matches('dialog, [role="dialog"]')) return 'Dialog';
  if (landmark.matches('nav, [role="navigation"]')) return 'Navigation';
  if (landmark.matches('form')) return 'Form';
  return landmark.tagName.toLowerCase();
}

export function visibleRect(element: HTMLElement, viewport: Window): DOMRect | null {
  if (!element.isConnected) return null;
  for (let parent: Element | null = element; parent; parent = parent.parentElement) {
    if (parent.hasAttribute('hidden') || parent.hasAttribute('inert') || parent.getAttribute('aria-hidden') === 'true') return null;
    const style = viewport.getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewport.innerHeight || rect.left >= viewport.innerWidth) return null;
  return rect;
}

function isSensitiveInput(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  if (['hidden', 'password', 'file'].includes(element.type)) return true;
  return (element.autocomplete || '').startsWith('cc-');
}

export function collectElements(doc: Document): { elements: ObservedElement[]; registry: Map<string, Element> } {
  const viewport = doc.defaultView;
  const elements: ObservedElement[] = [];
  const registry = new Map<string, Element>();
  if (!viewport) return { elements, registry };

  for (const element of doc.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
    if (elements.length >= MAX_ELEMENTS) break;
    if (element.closest('[contenteditable]') || isSensitiveInput(element)) continue;
    const rect = visibleRect(element, viewport);
    if (!rect) continue;

    const id = `el_${elements.length + 1}`;
    elements.push({
      id,
      role: roleFor(element),
      name: accessibleName(element),
      context: contextFor(element),
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
    registry.set(id, element);
  }

  return { elements, registry };
}
