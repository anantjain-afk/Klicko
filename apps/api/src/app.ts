import { Hono } from 'hono';
import {
  GuidanceRequestSchema, SelectionSchema, MAX_REQUEST_BYTES,
  validateGuidanceResponse, type ErrorCode,
} from '@clickpilot/shared/guidance';
import { containsSensitiveText, prepareProviderContext, type ProviderContext } from '@clickpilot/shared/privacy';

const MESSAGES: Record<ErrorCode, string> = {
  invalid_request: 'The request does not match the guidance contract.',
  invalid_json: 'The body must contain valid UTF-8 JSON.',
  payload_too_large: 'The request body exceeds the 64 KiB limit.',
  unsupported_media_type: 'Send uncompressed application/json.',
  unsafe_context: 'This context cannot be used for guidance.',
  provider_unavailable: 'No guidance provider is configured. Real AI integration requires milestone 5B.',
  provider_error: 'The guidance provider could not respond.',
  invalid_provider_response: 'The guidance provider returned an invalid response.',
  not_found: 'This API route does not exist.',
  method_not_allowed: 'Use POST for this API route.',
  local_only: 'This API is restricted to local development.',
  internal_error: 'The request could not be processed.',
};

function errorResponse(code: ErrorCode, status: number): Response {
  return Response.json({ protocolVersion: 1, kind: 'error', error: { code, message: MESSAGES[code] } }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readJson(request: Request): Promise<{ value: unknown } | { response: Response }> {
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) {
    return { response: errorResponse('payload_too_large', 413) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { response: errorResponse('invalid_json', 400) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { response: errorResponse('payload_too_large', 413) };
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { response: errorResponse('invalid_json', 400) };
  } finally { reader.releaseLock(); }
}

// Only tests inject deterministic replies. The runnable entrypoint supplies no
// provider, so valid requests return an explicit 503 rather than fake guidance.
export function createApp(provider?: (context: ProviderContext) => Promise<unknown>) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(c.req.url).hostname)) return errorResponse('local_only', 403);
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
    if (!provider) return errorResponse('provider_unavailable', 503);

    let output: unknown;
    try { output = await provider(context); } catch { return errorResponse('provider_error', 502); }
    const selection = SelectionSchema.safeParse(output);
    if (!selection.success) return errorResponse('invalid_provider_response', 502);
    const text = selection.data.kind === 'highlight' ? selection.data.instruction
      : selection.data.kind === 'ask_clarification' ? selection.data.question : selection.data.message;
    if (containsSensitiveText(text)) return errorResponse('invalid_provider_response', 502);
    const response = validateGuidanceResponse({
      protocolVersion: 1,
      sessionId: parsed.data.sessionId,
      requestId: parsed.data.requestId,
      pageKey: parsed.data.page.pageKey,
      snapshotId: parsed.data.page.snapshotId,
      result: selection.data,
    }, parsed.data, context.elements.map((element) => element.id));
    if (!response) return errorResponse('invalid_provider_response', 502);
    return c.json(response);
  });
  app.all('/v1/guidance/next', () => errorResponse('method_not_allowed', 405));
  app.notFound(() => errorResponse('not_found', 404));
  app.onError(() => errorResponse('internal_error', 500));
  return app;
}
