import type { GuidanceRequest, TaskContext } from './guidance';

export interface ProviderContext {
  userGoal: string;
  taskContext: TaskContext;
  page: { origin: string };
  elements: { id: string; role: string; name: string; context: string; expanded?: boolean }[];
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

export function eligibleElements(elements: { id: string; role: string; name: string; context: string; disabled: boolean; expanded?: boolean }[]): ProviderContext['elements'] {
  return elements.flatMap((element) => {
    const name = cleanText(element.name);
    const context = cleanText(element.context);
    return element.disabled || !name || containsSensitiveText(name) || containsSensitiveText(context)
      ? [] : [{ id: element.id, role: element.role, name, context,
        ...(typeof element.expanded === 'boolean' ? { expanded: element.expanded } : {}) }];
  });
}

export function isSensitivePage(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return true; }
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return true; }
  return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password
    || /(?:^|\/)(?:login|signin|sign-in|auth|oauth|password|reset-password|billing|payments?|checkout|bank|medical|health)(?:\/|$)/i.test(path)
    || containsSensitiveText(path);
}

export function prepareProviderContext(request: GuidanceRequest): ProviderContext | null {
  const url = new URL(request.page.url);
  if (isSensitivePage(request.page.url) || containsSensitiveText(request.userGoal)) return null;

  const previous = request.taskContext.previousStep;
  if (previous && containsSensitiveText(previous.action)) return null;
  const taskContext: TaskContext = { ...request.taskContext, previousStep: previous
    ? { ...previous, action: cleanText(previous.action) } : null };
  if (taskContext.previousStep && !taskContext.previousStep.action) return null;
  const elements = eligibleElements(request.elements);
  const userGoal = cleanText(request.userGoal);
  if (!userGoal) return null;
  return { userGoal, taskContext, page: { origin: url.origin }, elements };
}
