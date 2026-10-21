import type { GuidanceRequest } from './guidance';

export interface ProviderContext {
  userGoal: string;
  page: { origin: string };
  elements: { id: string; role: string; name: string; context: string }[];
}

export function containsSensitiveText(text: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)
    || /(?:\d[ -]?){12,}/.test(text)
    || /\b(?:AIza[\w-]+|sk-[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/.test(text)
    || /\b(?:bearer\s+\S+|password|passcode|api[ _-]?key|access[ _-]?token|credit card|card number|cvv|cvc|iban)\b/i.test(text);
}

function cleanText(text: string): string {
  // eslint-disable-next-line no-control-regex -- Control characters must not survive into provider text.
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function prepareProviderContext(request: GuidanceRequest): ProviderContext | null {
  const url = new URL(request.page.url);
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return null; }
  if (url.username || url.password
    || /(?:^|\/)(?:login|signin|sign-in|auth|oauth|password|reset-password|billing|payments?|checkout|bank|medical|health)(?:\/|$)/i.test(path)
    || containsSensitiveText(request.userGoal)) return null;

  const elements: ProviderContext['elements'] = [];
  for (const element of request.elements) {
    const name = cleanText(element.name);
    const context = cleanText(element.context);
    if (element.disabled || !name || containsSensitiveText(name) || containsSensitiveText(context)) continue;
    elements.push({ id: element.id, role: element.role, name, context });
  }
  const userGoal = cleanText(request.userGoal);
  if (!userGoal) return null;
  return { userGoal, page: { origin: url.origin }, elements };
}
