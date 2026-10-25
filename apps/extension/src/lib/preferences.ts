export const AI_PREFERENCES_KEY = 'clickpilot.ai-sharing';

export interface AiPreferences {
  version: 1;
  onboardingComplete: boolean;
  guidance: boolean;
  selectedText: boolean;
}

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  version: 1, onboardingComplete: false, guidance: false, selectedText: false,
};

// Unknown versions or incomplete records never authorize an upload.
export function readAiPreferences(value: unknown): AiPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_AI_PREFERENCES };
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join() !== 'guidance,onboardingComplete,selectedText,version'
    || item.version !== 1 || typeof item.onboardingComplete !== 'boolean'
    || typeof item.guidance !== 'boolean' || typeof item.selectedText !== 'boolean') return { ...DEFAULT_AI_PREFERENCES };
  return { version: 1, onboardingComplete: item.onboardingComplete,
    guidance: item.onboardingComplete && item.guidance, selectedText: item.onboardingComplete && item.selectedText };
}
