import { MAX_SELECTION_LENGTH, normalizeText, prepareText } from '@clickpilot/shared/text-assistant';
import { isSensitivePage } from '@clickpilot/shared/privacy';

const EXCLUDED = 'input, textarea, select, option, [contenteditable], [role="textbox"], [role="searchbox"], form, [hidden], [inert], [aria-hidden="true"], script, style, noscript, iframe, object, embed, canvas, #clickpilot-overlay, #clickpilot-text';
const MAX_SELECTION_NODES = 500;

function allowedElement(element: Element): boolean {
  if (element.closest(EXCLUDED) || element.getRootNode() !== document) return false;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') return false;
    const label = `${current.getAttribute('aria-label') ?? ''} ${current.id} ${current.getAttribute('autocomplete') ?? ''}`;
    if (/password|payment|checkout|billing|credit.?card|medical|health|private|sensitive/i.test(label)) return false;
  }
  return true;
}

export function readSelectedRange(range: Range): string | null {
  if (range.collapsed || !range.startContainer.isConnected || !range.endContainer.isConnected
    || range.startContainer.getRootNode() !== document || range.endContainer.getRootNode() !== document) return null;
  const root = range.commonAncestorContainer;
  let text = '';
  let visited = 0;
  const accept = (node: Node): boolean => {
    if (++visited > MAX_SELECTION_NODES) return false;
    if (!range.intersectsNode(node)) return true;
    const parent = node instanceof Element ? node : node.parentElement;
    if (!parent || !allowedElement(parent)) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.textContent?.length ?? 0;
      if (end - start > MAX_SELECTION_LENGTH - text.length) return false;
      text += (node.textContent ?? '').slice(start, end);
      if (text.length > MAX_SELECTION_LENGTH) return false;
    } else if (node instanceof HTMLBRElement || (node instanceof Element && node !== root
      && ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(node.tagName))) text += ' ';
    return true;
  };
  if (!accept(root)) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (++visited > MAX_SELECTION_NODES) return NodeFilter.FILTER_ACCEPT;
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) if (!accept(walker.currentNode)) return null;
  return prepareText(text, 'Explain this passage')?.selectedText ?? null;
}

export function captureSelection(): { range: Range; text: string } | null {
  if (document.hidden || window.top !== window || isSensitivePage(location.href)) return null;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const text = readSelectedRange(range);
  return text ? { range, text } : null;
}

export function selectionAnchor(range: Range): DOMRect | null {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const right = left + (viewport?.width ?? innerWidth);
  const bottom = top + (viewport?.height ?? innerHeight);
  return Array.from(range.getClientRects()).reverse().find((rect) => rect.width > 0 && rect.height > 0
    && rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom) ?? null;
}

export function bubblePosition(anchor: { left: number; right: number; top: number; bottom: number }, box: { width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number }): { left: number; top: number } | null {
  const margin = 12;
  const right = viewport.left + viewport.width - margin;
  const bottom = viewport.top + viewport.height - margin;
  if (box.width > viewport.width - margin * 2 || box.height > viewport.height - margin * 2) return null;
  const below = anchor.bottom + 8;
  const top = below + box.height <= bottom ? below : anchor.top - box.height - 8;
  if (top < viewport.top + margin || top + box.height > bottom) return null;
  return { left: Math.max(viewport.left + margin, Math.min(anchor.right - box.width, right - box.width)), top };
}

export function sameSelectedText(range: Range, text: string): boolean {
  return readSelectedRange(range) === normalizeText(text);
}
