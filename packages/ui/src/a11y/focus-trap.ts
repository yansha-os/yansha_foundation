/**
 * Keyboard logic for the shared Modal primitive.
 *
 * `trapTabTarget` and `isDismissKey` are pure and covered in the node-env suite
 * (lib/__tests__/ui-primitives.test.ts). The tabbability predicate below needs a
 * DOM, so it is covered behaviourally in the jsdom suite
 * (lib/__tests__/modal-dom.test.tsx) — never by asserting on a selector string.
 */

/**
 * Everything that could plausibly be a Tab stop. Deliberately over-broad: this
 * is only the cheap first pass, and `isTabbable` decides. Keeping the
 * disqualifying conditions out of the selector is the point — they are
 * behaviour, and behaviour belongs somewhere a test can exercise it.
 */
const TABBABLE_CANDIDATE = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "audio[controls]",
  "video[controls]",
  "iframe",
  "[tabindex]",
  "[contenteditable]",
].join(",");

/** `visibility` and `display` that make a control unreachable, including via an ancestor. */
function isRenderedVisible(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  // `visibility` is inherited, so the element's own computed value already
  // accounts for a hidden ancestor — and correctly lets a descendant opt back in
  // with `visibility: visible`.
  const own = view.getComputedStyle(el);
  if (own && (own.visibility === "hidden" || own.visibility === "collapse")) return false;

  // `display` is not inherited: `display: none` on an ancestor removes the
  // subtree from rendering without changing the child's own computed `display`,
  // so ancestors have to be walked.
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (view.getComputedStyle(node)?.display === "none") return false;
  }
  return true;
}

/** Content of a collapsed `<details>` is not rendered; its own `<summary>` is. */
function isInCollapsedDetails(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const details: HTMLElement | null = node.parentElement;
    if (!details || details.tagName !== "DETAILS") continue;
    if ((details as HTMLDetailsElement).open) continue;
    // The first <summary> child is the disclosure control and stays interactive.
    if (node.tagName === "SUMMARY" && details.querySelector("summary") === node) continue;
    return true;
  }
  return false;
}

/**
 * Whether Tab can actually land on `el` right now.
 *
 * Each exclusion is a deliberate decision, not an accident of a selector:
 * - **negative `tabindex` of any value** — excluded. `-1`, `-2` and `-9` all
 *   mean "focusable programmatically, not in sequential navigation".
 * - **`disabled`** — excluded, including via a `disabled` ancestor `<fieldset>`.
 * - **`inert`** — excluded, and so is everything inside an inert subtree: inert
 *   content is removed from the tab order by definition.
 * - **`aria-hidden="true"`** — excluded, subtree included. A control hidden from
 *   assistive technology but reachable by Tab is a focus black hole.
 * - **collapsed `<details>`** — excluded, except the `<summary>` itself.
 * - **`hidden`, `display: none`, `visibility: hidden`** — excluded.
 * - **`contenteditable`** — INCLUDED. An editable region is a genuine tab stop
 *   and a dialog must be able to cycle into it.
 *
 * KNOWN LIMITATION — shadow DOM: `querySelectorAll` does not pierce shadow
 * roots, so a tab stop inside a custom element's shadow tree is invisible to
 * this trap. This app ships no web components and never calls `attachShadow`
 * (verified by source search), so piercing is not implemented rather than
 * silently claimed. Anything introducing shadow DOM inside a dialog must
 * revisit `tabbablesWithin`.
 */
export function isTabbable(el: Element): boolean {
  const tabindex = el.getAttribute("tabindex");
  // An unparseable value is ignored by the HTML spec, so it falls through to the
  // element's natural focusability rather than being guessed at.
  const explicitIndex = tabindex === null ? null : Number.parseInt(tabindex, 10);
  const hasValidIndex = explicitIndex !== null && Number.isFinite(explicitIndex);
  if (hasValidIndex && (explicitIndex as number) < 0) return false;

  // `:disabled` rather than the attribute, so a control inside a disabled
  // <fieldset> is excluded too.
  if (el.matches(":disabled")) return false;
  if (el.tagName === "INPUT" && el.getAttribute("type")?.toLowerCase() === "hidden") return false;
  if (el.closest("[inert]")) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.closest("[hidden]")) return false;
  if (isInCollapsedDetails(el)) return false;
  if (!isRenderedVisible(el)) return false;

  // Nothing is disqualifying, so the question is whether this element is a tab
  // stop at all. The candidate selector is deliberately over-broad, so a
  // positive answer is required rather than assumed: `[tabindex]` and
  // `[contenteditable]` both match elements that are not focusable
  // (`contenteditable="false"`, an unparseable `tabindex` on a plain `<div>`).
  if (hasValidIndex) return true;
  if (NATURALLY_TABBABLE.has(el.tagName)) return true;
  const editable = el.getAttribute("contenteditable");
  if (editable !== null) return editable.toLowerCase() !== "false";
  return false;
}

/**
 * Tags that are tab stops without a `tabindex`. The candidate selector has
 * already required `href` on links and `controls` on media, so tag name is
 * enough here.
 */
const NATURALLY_TABBABLE = new Set([
  "A",
  "AREA",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "SUMMARY",
  "AUDIO",
  "VIDEO",
  "IFRAME",
]);

/** Every tab stop inside `root`, in document order. */
export function tabbablesWithin(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_CANDIDATE)).filter(isTabbable);
}

export function isDismissKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

/** Focus belongs on the dialog container itself, not on a child. */
export const TRAP_CONTAINER = "container" as const;

export type TrapTarget = number | typeof TRAP_CONTAINER;

/**
 * Where Tab must land next inside a trap of `count` focusable elements.
 *
 * The contract is absolute: there is no return value that means "let the
 * browser decide". Every answer is either an index inside the trap or
 * TRAP_CONTAINER, which the caller focuses (the dialog carries tabIndex={-1}
 * for exactly this case). An empty dialog therefore still swallows Tab and
 * Shift+Tab instead of handing focus to the page behind it.
 *
 * `current` is -1 when focus sits on the container (the state right after
 * open): Tab enters at the first element, Shift+Tab at the last.
 */
export function trapTabTarget(current: number, count: number, shiftKey: boolean): TrapTarget {
  if (count <= 0) return TRAP_CONTAINER;
  if (current < 0) return shiftKey ? count - 1 : 0;
  return shiftKey ? (current - 1 + count) % count : (current + 1) % count;
}
