// Shared page-CSS isolation. Only explicitly interactive surfaces receive focus.
export function createOverlaySurface(id: string, interactive = false) {
  const host = document.createElement('div');
  host.id = id;
  if (!interactive) host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all: initial !important; position: fixed !important; inset: 0 !important; width: auto !important; height: auto !important; pointer-events: none !important; z-index: 2147483647 !important;';
  const shadow = host.attachShadow({ mode: 'open' });
  return { host, shadow };
}
