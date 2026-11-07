// The "?" control that opens an explanation on click (docs/ux/redesign-plan.md phase 5). The
// text comes from the catalogue in src/ui/help/. The button tells assistive technology whether
// the text is open, and the text stays in the page while it is closed, so aria-controls always
// points at an element.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { type HelpKey, helpText } from './help';

export function HelpBody({ topic }: { readonly topic: HelpKey }) {
  const text = helpText(topic);
  return (
    <>
      <p>{text.what}</p>
      {text.why !== undefined && (
        <p>
          <strong>Why it matters.</strong> {text.why}
        </p>
      )}
      {text.example !== undefined && (
        <p>
          <strong>Example.</strong> {text.example}
        </p>
      )}
      {text.source !== undefined && (
        <p class="help-source">
          <strong>Source.</strong> {text.source}
        </p>
      )}
    </>
  );
}

// A toggle and its text, for a parent that places them apart (a label row, then the text).
// visible replaces the "?" with words, for a toggle that stands alone on a line.
export function useExplain(id: string, topic: HelpKey | undefined, name: string, visible?: string): { readonly toggle: ComponentChildren; readonly text: ComponentChildren } {
  const [open, setOpen] = useState(false);
  if (topic === undefined) return { toggle: null, text: null };
  const panel = `${id}-explain`;
  return {
    toggle: (
      <button
        type="button"
        class={visible === undefined ? 'explain-toggle' : 'explain-toggle explain-words'}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {visible === undefined ? <span aria-hidden="true">?</span> : <span aria-hidden="true">{visible}</span>}
        <span class="visually-hidden">Explain {name}</span>
      </button>
    ),
    text: (
      <div class="explain-text" id={panel} hidden={!open}>
        <HelpBody topic={topic} />
      </div>
    ),
  };
}

// A toggle with its text right below it. For a button, a table or a part with no label row.
export function Explain({ id, topic, name, visible }: { readonly id: string; readonly topic: HelpKey; readonly name: string; readonly visible?: string }) {
  const { toggle, text } = useExplain(id, topic, name, visible);
  return (
    <div class="explain">
      {toggle}
      {text}
    </div>
  );
}
