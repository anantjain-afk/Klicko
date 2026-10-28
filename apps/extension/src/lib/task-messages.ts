import type { GuidanceState } from '../features/session/session';
import type { TextState } from '../features/text-assistant/session';
import { safeTextResult } from '@clickpilot/shared/text-assistant';

export interface SharedMessage {
  id: number;
  role: 'user' | 'assistant';
  source: 'guidance' | 'text';
  text: string;
}
export interface TaskView {
  type: 'TASK_VIEW';
  version: 1;
  tabId: number;
  epoch: string;
  taskId: string;
  revision: number;
  goal: string;
  state: GuidanceState;
  textState: TextState;
  messages: SharedMessage[];
  source: 'guidance' | 'text';
  active: boolean;
  buddyVisible: boolean;
  textEnabled: boolean;
  storageAvailable: boolean;
  guidanceConsent: boolean;
  textConsent: boolean;
  recovered: boolean;
  activationNotice?: string;
}
export type TaskAction = 'start' | 'stop' | 'retry' | 'continue' | 'continue-manually' | 'done' | 'new-chat'
  | 'text-enable' | 'text-stop' | 'hide';
export interface TaskCommand {
  type: 'TASK_COMMAND';
  id: string;
  epoch: string;
  taskId: string;
  action: TaskAction;
  goal?: string;
}
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f\d-]{36}$/i.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const stateKinds = ['idle', 'navigating', 'connection_paused', 'observing', 'selecting', 'highlighting', 'waiting', 'verifying',
  'recovery', 'confirmed', 'answer', 'clicked', 'clarification', 'unsupported', 'paused', 'error', 'stopped'];
export function isTaskCommand(v: unknown): v is TaskCommand {
  if (!isRecord(v) || Object.keys(v).some((key) => !['type', 'id', 'epoch', 'taskId', 'action', 'goal'].includes(key))) return false;
  return v.type === 'TASK_COMMAND' && uuid(v.id) && uuid(v.epoch) && uuid(v.taskId)
    && ['start', 'stop', 'retry', 'continue', 'continue-manually', 'done', 'new-chat', 'text-enable', 'text-stop', 'hide'].includes(String(v.action))
    && (v.action === 'start' ? text(v.goal, 240) && v.goal.trim().length > 0 : v.goal === undefined);
}
function guidanceState(v: unknown): boolean {
  if (!isRecord(v) || !stateKinds.includes(String(v.kind))) return false;
  if (Object.keys(v).some((key) => !['kind', 'message', 'instruction', 'stepNumber', 'nextStep', 'previousStatus', 'canContinue', 'attempt'].includes(key))) return false;
  if (v.message !== undefined && !text(v.message, 600)) return false;
  if (v.canContinue !== undefined && typeof v.canContinue !== 'boolean') return false;
  if (['observing', 'selecting', 'highlighting'].includes(String(v.kind))) return integer(v.attempt) && v.attempt <= 1;
  if (v.kind === 'waiting') return text(v.instruction, 160) && integer(v.stepNumber) && v.stepNumber <= 20
    && ['none', 'after_user_action'].includes(String(v.nextStep))
    && (v.previousStatus === undefined || ['pending', 'verified', 'not_verified', 'unverifiable', 'user_confirmed'].includes(String(v.previousStatus)));
  return v.kind === 'idle' || text(v.message, 600);
}
function textState(v: unknown): boolean {
  return isRecord(v) && ['idle', 'ready', 'selected', 'composing', 'requesting', 'answered', 'error', 'stopped'].includes(String(v.kind))
    && Object.keys(v).every((key) => ['kind', 'message', 'question', 'result', 'canRetry'].includes(key))
    && text(v.message, 600) && (v.question === undefined || text(v.question, 240))
    && (v.result === undefined || safeTextResult(v.result) !== null)
    && (v.canRetry === undefined || typeof v.canRetry === 'boolean');
}
export function isTaskView(v: unknown): v is TaskView {
  if (!isRecord(v) || Object.keys(v).some((key) => !['type', 'version', 'tabId', 'epoch', 'taskId', 'revision', 'goal', 'state', 'textState', 'messages', 'source', 'active', 'buddyVisible', 'textEnabled', 'storageAvailable', 'guidanceConsent', 'textConsent', 'recovered', 'activationNotice'].includes(key))) return false;
  if (v.activationNotice !== undefined && !text(v.activationNotice, 240)) return false;
  if (!isRecord(v) || v.type !== 'TASK_VIEW' || v.version !== 1 || !integer(v.tabId) || !uuid(v.epoch)
    || !uuid(v.taskId) || !integer(v.revision) || !text(v.goal, 240) || !guidanceState(v.state) || !textState(v.textState)
    || !['guidance', 'text'].includes(String(v.source))) return false;
  if (!['active', 'buddyVisible', 'textEnabled', 'storageAvailable', 'guidanceConsent', 'textConsent', 'recovered'].every((key) => typeof v[key] === 'boolean')) return false;
  return Array.isArray(v.messages) && v.messages.length <= 80 && v.messages.every((m: unknown) => isRecord(m)
    && Object.keys(m).sort().join() === 'id,role,source,text' && integer(m.id) && ['user', 'assistant'].includes(String(m.role))
    && ['guidance', 'text'].includes(String(m.source)) && text(m.text, 2000));
}
