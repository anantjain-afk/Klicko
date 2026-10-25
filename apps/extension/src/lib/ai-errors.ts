import type { ErrorCode } from '@clickpilot/shared/guidance';

export function aiServiceError(code: ErrorCode | 'connection' | 'invalid_reply'): Error {
  let message = "ClickPilot couldn't connect. Try again.";
  switch (code) {
    case 'invalid_reply':
    case 'invalid_provider_response': message = "ClickPilot couldn't use that reply safely. Try again."; break;
    case 'rate_limited': message = 'The AI usage limit was reached. Wait before trying again.'; break;
    case 'timeout': message = 'ClickPilot took too long to reply. Try again.'; break;
    case 'cancelled': message = 'The request was cancelled.'; break;
    case 'service_disabled': message = 'AI assistance is turned off in your backend settings.'; break;
    case 'unsafe_context': message = 'This page or question may contain sensitive information. Try public content instead.'; break;
    case 'payload_too_large': message = 'There is too much information to send. Try a shorter passage or a simpler page.'; break;
    case 'local_only': message = 'Your backend only accepts local connections. Check its settings and try again.'; break;
  }
  // Preserve a fixed diagnostic code without retaining page text or provider bodies.
  return new Error(message, { cause: code });
}
