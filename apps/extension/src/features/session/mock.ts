import type { PageSnapshot } from '../../lib/messages';

export type MockScenario = 'normal' | 'delayed' | 'stale-once' | 'stale-always' | 'invalid-output';

export type MockSelection =
  | { kind: 'highlight'; targetId: string; instruction: string }
  | { kind: 'clarification' | 'unsupported' | 'missing'; message: string };

export function isMockFixtureUrl(address: string): boolean {
  const url = new URL(address);
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
    && url.port === '4173' && url.pathname === '/guidance.html';
}

export function selectMockTarget(snapshot: PageSnapshot, task: string): MockSelection {
  if (!snapshot.mockFixture) return { kind: 'unsupported', message: 'Mock guidance only works on the local guidance fixture at http://127.0.0.1:4173/guidance.html.' };
  const question = task.trim().toLowerCase().replace(/[?.!]+$/g, '').replace(/\s+/g, ' ').trim();
  let name: string;
  let context: string | undefined;
  switch (question) {
    case 'find settings': name = 'Settings'; break;
    case 'find navigation settings': name = 'Settings'; context = 'Main navigation'; break;
    case 'find dialog settings': name = 'Settings'; context = 'Preferences'; break;
    case 'find profile': name = 'Profile'; break;
    case 'open help': name = 'Open help'; break;
    case 'find primary target': name = 'Primary target'; break;
    default: return { kind: 'unsupported', message: 'This mock does not understand that request. Try “find primary target”, “find profile”, “open help”, or a Settings example below.' };
  }
  const matches = snapshot.elements.filter((element) => !element.disabled && element.name === name
    && (context === undefined || element.context === context));
  if (matches.length === 0) return { kind: 'missing', message: `No visible, enabled ${name} control matches this request. Restore the fixture and Retry.` };
  if (matches.length > 1) return { kind: 'clarification', message: 'More than one control matches. For Settings, ask “find navigation settings” or “find dialog settings”.' };
  return { kind: 'highlight', targetId: matches[0]!.id, instruction: `Click ${name}${context ? ` in ${context}` : ''} yourself. Mock guidance will only acknowledge the click.` };
}

export function isMockSelection(value: unknown): value is MockSelection {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (result.kind === 'highlight') return typeof result.targetId === 'string' && /^el_\d{1,3}$/.test(result.targetId)
    && typeof result.instruction === 'string' && result.instruction.trim().length > 0 && result.instruction.length <= 240;
  return typeof result.kind === 'string' && ['clarification', 'unsupported', 'missing'].includes(result.kind)
    && typeof result.message === 'string' && result.message.length > 0 && result.message.length <= 240;
}

export async function mockSelection(snapshot: PageSnapshot, task: string, scenario: MockScenario, attempt: number, signal: AbortSignal): Promise<unknown> {
  if (scenario === 'delayed') {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const selection = selectMockTarget(snapshot, task);
  if (selection.kind !== 'highlight') return selection;
  if (scenario === 'invalid-output') return { kind: 'highlight', instruction: 42 };
  if (scenario === 'stale-always' || (scenario === 'stale-once' && attempt === 0)) {
    return { ...selection, targetId: 'el_150' };
  }
  return selection;
}
