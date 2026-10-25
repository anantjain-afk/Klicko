import { Hono } from 'hono';
import { geminiReply, geminiTextReply, ProviderError, type GeminiEnv } from './gemini';
import { MAX_TEXT_BYTES, TextRequestSchema, prepareText, safeTextResult } from '@clickpilot/shared/text-assistant';
import {
  GuidanceRequestSchema, AssistantResultSchema, MAX_REQUEST_BYTES,
  validateGuidanceResponse, type ErrorCode,
} from '@clickpilot/shared/guidance';
import { containsSensitiveText, prepareProviderContext, type ProviderContext } from '@clickpilot/shared/privacy';
import { reportValidationFailure } from './diagnostics';

const MESSAGES: Record<ErrorCode, string> = {
  invalid_request: 'The request does not match the guidance contract.',
  invalid_json: 'The body must contain valid UTF-8 JSON.',
  payload_too_large: 'The request body exceeds the 64 KiB limit.',
  unsupported_media_type: 'Send uncompressed application/json.',
  unsafe_context: 'This context cannot be used for guidance.',
  provider_unavailable: 'The local Gemini provider is not configured.',
  provider_error: 'The guidance provider could not respond.',
  invalid_provider_response: 'The guidance provider returned an invalid response.',
  not_found: 'This API route does not exist.',
  method_not_allowed: 'Use POST for this API route.',
  local_only: 'This API is restricted to local development.',
  internal_error: 'The request could not be processed.',
  service_disabled: 'The local AI service is disabled.',
  rate_limited: 'Gemini quota was reached. Wait before retrying.',
  timeout: 'Gemini took too long to respond. Please retry.',
  cancelled: 'The request was cancelled.',
};

function errorResponse(code: ErrorCode, status: number, protocolVersion = 3): Response {
  const message = protocolVersion === 1 && code === 'payload_too_large' ? 'The text request exceeds the 16 KiB limit.' : MESSAGES[code];
  return Response.json({ protocolVersion, kind: 'error', error: { code, message } }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readJson(request: Request, limit = MAX_REQUEST_BYTES, version = 3): Promise<{ value: unknown } | { response: Response }> {
  if (Number(request.headers.get('Content-Length')) > limit) {
    return { response: errorResponse('payload_too_large', 413, version) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { response: errorResponse('invalid_json', 400, version) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return { response: errorResponse('payload_too_large', 413, version) };
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { response: errorResponse('invalid_json', 400, version) };
  } finally { reader.releaseLock(); }
}

// Tests may inject deterministic replies; the runnable path uses backend-only secrets.
export function createApp(provider?: (context: ProviderContext, signal: AbortSignal) => Promise<unknown>,
  textProvider?: (context: { selectedText: string; question: string }, signal: AbortSignal) => Promise<unknown>) {
  const app = new Hono<{ Bindings: GeminiEnv }>();
  app.use('*', async (c, next) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(c.req.url).hostname)) return errorResponse('local_only', 403, c.req.path === '/v1/text/explain' ? 1 : 3);
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.post('/v1/guidance/next', async (c) => {
    const type = c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    const encoding = c.req.header('Content-Encoding');
    if (type !== 'application/json' || (encoding && encoding.toLowerCase() !== 'identity')) {
      return errorResponse('unsupported_media_type', 415);
    }
    const body = await readJson(c.req.raw);
    if ('response' in body) return body.response;
    const parsed = GuidanceRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse('invalid_request', 400);
    const context = prepareProviderContext(parsed.data);
    if (!context) return errorResponse('unsafe_context', 422);

    let output: unknown;
    try { output = await (provider ? provider(context, c.req.raw.signal) : geminiReply(context, c.req.raw.signal, c.env ?? {})); }
    catch (error) {
      return error instanceof ProviderError ? errorResponse(error.code, error.status) : errorResponse('provider_error', 502);
    }
    if (c.req.raw.signal.aborted) return errorResponse('cancelled', 499);
    const selection = AssistantResultSchema.safeParse(output);
    if (!selection.success) {
      reportValidationFailure(c.env ?? {}, 'assistant_schema', selection.error.issues);
      return errorResponse('invalid_provider_response', 502);
    }
    if (containsSensitiveText(selection.data.message)
      || (selection.data.kind === 'guidance' && containsSensitiveText(selection.data.instruction))) {
      reportValidationFailure(c.env ?? {}, 'sensitive_output');
      return errorResponse('invalid_provider_response', 502);
    }
    const response = validateGuidanceResponse({
      protocolVersion: 3,
      sessionId: parsed.data.sessionId,
      requestId: parsed.data.requestId,
      pageKey: parsed.data.page.pageKey,
      snapshotId: parsed.data.page.snapshotId,
      result: selection.data,
    }, parsed.data, context.elements.map((element) => element.id));
    if (!response) {
      const missingTarget = selection.data.kind === 'guidance'
        && !context.elements.map((element) => element.id).includes(selection.data.targetId);
      reportValidationFailure(c.env ?? {}, missingTarget ? 'target_membership' : 'response_envelope');
      return errorResponse('invalid_provider_response', 502);
    }
    return c.json(response);
  });
  app.all('/v1/guidance/next', () => errorResponse('method_not_allowed', 405));
  app.post('/v1/text/explain', async (c) => {
    const type = c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    const encoding = c.req.header('Content-Encoding');
    if (type !== 'application/json' || (encoding && encoding.toLowerCase() !== 'identity')) return errorResponse('unsupported_media_type', 415, 1);
    const body = await readJson(c.req.raw, MAX_TEXT_BYTES, 1);
    if ('response' in body) return body.response;
    const parsed = TextRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse('invalid_request', 400, 1);
    const context = prepareText(parsed.data.selectedText, parsed.data.question);
    if (!context) return errorResponse('unsafe_context', 422, 1);
    try {
      const output = await (textProvider ? textProvider(context, c.req.raw.signal) : geminiTextReply(context, c.req.raw.signal, c.env ?? {}));
      if (c.req.raw.signal.aborted) return errorResponse('cancelled', 499, 1);
      const result = safeTextResult(output);
      if (!result) return errorResponse('invalid_provider_response', 502, 1);
      const { sessionId, requestId, pageKey, selectionId } = parsed.data;
      return c.json({ protocolVersion: 1, sessionId, requestId, pageKey, selectionId, result });
    } catch (error) {
      return error instanceof ProviderError ? errorResponse(error.code, error.status, 1) : errorResponse('provider_error', 502, 1);
    }
  });
  app.all('/v1/text/explain', () => errorResponse('method_not_allowed', 405, 1));
  app.notFound(() => errorResponse('not_found', 404));
  app.onError((_, c) => errorResponse('internal_error', 500, c.req.path === '/v1/text/explain' ? 1 : 3));
  return app;
}
