// A section of a full editor screen that the user can fold (docs/ux/redesign-plan.md Sec. 3.3).
// The heading stays a level 2 heading inside the summary, so heading navigation still finds it.
// A fold stays as the user left it until the page loads again. Print opens every section.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Explain } from './explain';
import type { HelpKey } from './help';

const folds = new Map<string, boolean>();

export function Section({
  id,
  title,
  folded = false,
  class: extra,
  help,
  helpName,
  children,
}: {
  // The heading gets the id `${id}-title`, as before, so the steps panel and links still find it.
  readonly id: string;
  readonly title: ComponentChildren;
  // True starts the section folded, for a large table or a part that few users need.
  readonly folded?: boolean;
  readonly class?: string;
  // The explanation of the section. It opens from a "?" at the top of the section body,
  // because a button inside the summary would be a control inside a control.
  readonly help?: HelpKey;
  // The name in the label of the "?" when the title is not plain text.
  readonly helpName?: string;
  readonly children: ComponentChildren;
}) {
  const [open, setOpen] = useState(folds.get(id) ?? !folded);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = (): void => {
      setPrinting(true);
    };
    const after = (): void => {
      setPrinting(false);
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return (
    <section aria-labelledby={`${id}-title`} class={extra === undefined ? 'panel fold' : `panel fold ${extra}`}>
      <details
        open={open || printing}
        onToggle={(event) => {
          if (printing) return;
          const next = event.currentTarget.open;
          folds.set(id, next);
          setOpen(next);
        }}
      >
        <summary>
          <h2 id={`${id}-title`}>{title}</h2>
        </summary>
        <div class="fold-body">
          {help !== undefined && <Explain id={`${id}-section`} topic={help} name={helpName ?? (typeof title === 'string' ? title : id)} visible="About this section" />}
          {children}
        </div>
      </details>
    </section>
  );
}

// Opens the folded section that holds an element, so a link to a field or heading can show it.
export function unfold(target: Element): void {
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
  }
}
