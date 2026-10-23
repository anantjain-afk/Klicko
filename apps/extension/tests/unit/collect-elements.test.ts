import { beforeEach, describe, expect, it } from 'vitest';
import { collectElements } from '../../src/features/observer/collect-elements';

function placeVisibleElements() {
  for (const element of document.querySelectorAll<HTMLElement>('[data-rect]')) {
    element.getBoundingClientRect = () => DOMRect.fromRect({ x: 20, y: 30, width: 120, height: 35 });
  }
}

describe('collectElements', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps visible controls and omits hidden, offscreen, and detached controls', () => {
    document.body.innerHTML = `
      <button data-rect>Settings</button>
      <button data-rect hidden>Hidden</button>
      <button data-rect style="display: none">Gone</button>
      <button data-rect aria-hidden="true">Secret</button>
      <button data-rect id="offscreen">Far away</button>
    `;
    placeVisibleElements();
    document.querySelector<HTMLElement>('#offscreen')!.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 20, y: 5000, width: 120, height: 35 });
    const detached = document.createElement('button');
    detached.textContent = 'Detached';

    const result = collectElements(document);
    expect(result.elements.map((item) => item.name)).toEqual(['Settings']);
    expect(result.registry.get('el_1')?.textContent).toBe('Settings');
    expect(result.registry.has('el_2')).toBe(false);
  });

  it('uses accessible names and distinct context for duplicate labels', () => {
    document.body.innerHTML = `
      <nav aria-label="Account navigation"><button data-rect>Settings</button></nav>
      <dialog open><button data-rect>Settings</button></dialog>
      <label for="search">Find a project</label><input data-rect id="search" value="PRIVATE-INPUT" />
      <button data-rect aria-label="Open menu">≡</button>
      <button data-rect aria-labelledby="named"></button><span id="named">Help</span>
    `;
    placeVisibleElements();

    const result = collectElements(document).elements;
    expect(result.map(({ name, context }) => [name, context])).toEqual([
      ['Settings', 'Dialog'],
      ['Settings', 'Account navigation'],
      ['Find a project', ''],
      ['Open menu', ''],
      ['Help', ''],
    ]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-INPUT');
  });

  it('never includes sensitive fields, editable text, or hidden button text', () => {
    document.body.innerHTML = `
      <input data-rect type="password" value="PRIVATE-PASSWORD" />
      <input data-rect autocomplete="cc-number" value="4111111111111111" />
      <textarea data-rect>PRIVATE-NOTE</textarea>
      <div contenteditable="true"><button data-rect>PRIVATE-EDITABLE</button></div>
      <button data-rect>Continue <span hidden>PRIVATE-HIDDEN</span><span style="display: none">PRIVATE-STYLED</span></button>
      <button data-rect aria-label="person@example.com">Account</button>
    `;
    placeVisibleElements();

    const result = collectElements(document).elements;
    const serialized = JSON.stringify(result);
    expect(result.map((item) => item.name)).toEqual(['', 'Continue', 'Account']);
    for (const secret of ['PRIVATE-PASSWORD', '4111111111111111', 'PRIVATE-NOTE', 'PRIVATE-EDITABLE', 'PRIVATE-HIDDEN', 'PRIVATE-STYLED', 'person@example.com']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('marks disabled controls and caps the inventory at 150', () => {
    document.body.innerHTML = '<button data-rect disabled>Disabled</button>'
      + Array.from({ length: 160 }, (_, index) => `<button data-rect>Item ${index}</button>`).join('');
    placeVisibleElements();

    const result = collectElements(document);
    expect(result.elements).toHaveLength(150);
    expect(result.elements[0]).toMatchObject({ id: 'el_1', disabled: true, role: 'button' });
    expect(result.elements[149]?.id).toBe('el_150');
  });
});
