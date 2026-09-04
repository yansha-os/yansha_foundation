/**
 * Shared registry of the currently open dialogs.
 *
 * Every open Modal listens for keydown on the document, so without a shared
 * notion of "which dialog is on top" a parent dialog would consume Escape and
 * Tab that belong to a nested child (stopPropagation does not stop sibling
 * listeners on the same target).
 *
 * Topmost is decided by document position rather than registration order.
 * Registration order is not something to rely on: React does not document the
 * order in which it runs a child's effects relative to its parent's, so a
 * nested dialog may well register *before* the dialog that contains it. Nothing
 * here depends on which way that goes — document position is the input, and it
 * is also what decides paint order, since every dialog renders inline (no
 * portal) with the same `--z-modal`. Entries whose panel is detached are
 * ignored, which is what makes a dialog that is mid-close (rendered `null`,
 * cleanup not yet run) stop claiming the top slot.
 *
 * KNOWN LIMITATION — ancestor stacking contexts. Document position equals paint
 * order only while the open dialogs share a stacking context. Two dialogs
 * mounted under ancestors that each establish one (a `transform`, a non-`auto`
 * `opacity`, a positioned ancestor with its own `z-index`) are painted in the
 * order of those ancestors, and the DOM-later dialog can end up underneath. The
 * app cannot hit this today: `RealmSwitcherModal` is the only consumer and
 * nothing nests dialogs. The robust fix is to portal every panel to
 * `document.body`, which removes ancestor stacking contexts from the question
 * entirely; that is deliberately not done inside this bead because it changes
 * how every dialog mounts, and is tracked as its own bead alongside the
 * Yansha-6m2 migration that first makes multiple dialogs coexist.
 */

export type ModalStackEntry = {
  id: number;
  /** Read lazily: the panel ref can change or be nulled while mounted. */
  panel: () => HTMLElement | null;
};

const entries: ModalStackEntry[] = [];

let nextId = 0;

export function createModalId(): number {
  nextId += 1;
  return nextId;
}

/** Registers an open dialog. The returned function deregisters it. */
export function registerModal(entry: ModalStackEntry): () => void {
  entries.push(entry);
  return () => {
    // Removed by identity, never popped: dialogs unmount out of order (a parent
    // can close while its child is still open), and a repeated release must not
    // evict somebody else's entry.
    const index = entries.findIndex((candidate) => candidate.id === entry.id);
    if (index >= 0) entries.splice(index, 1);
  };
}

/** Node.DOCUMENT_POSITION_FOLLOWING, as a literal so this module stays DOM-free. */
const FOLLOWING = 0x04;

/** The id of the dialog painted on top, or null when none is attached. */
export function topmostModalId(): number | null {
  let topId: number | null = null;
  let topPanel: HTMLElement | null = null;

  for (const entry of entries) {
    const panel = entry.panel();
    if (!panel || !panel.isConnected) continue;
    // `a contains b` also reports FOLLOWING, so nested and sibling dialogs are
    // ordered by the same comparison.
    if (topPanel === null || (topPanel.compareDocumentPosition(panel) & FOLLOWING) !== 0) {
      topId = entry.id;
      topPanel = panel;
    }
  }

  return topId;
}

export function isTopmostModal(id: number): boolean {
  return topmostModalId() === id;
}

let scrollLocks = 0;
let overflowBeforeFirstLock = "";

/**
 * Counted body scroll lock. The pre-lock value is captured once, on the first
 * lock, so closing dialogs in any order restores the page's own overflow rather
 * than the `hidden` a sibling dialog had already applied.
 *
 * ACCEPTED LIMITATION: the snapshot is taken at first lock and never refreshed,
 * so page code that changes `document.body.style.overflow` *while* a dialog is
 * open has that change overwritten when the last dialog closes. Re-reading on
 * release would be worse — it would read back the `hidden` this module itself
 * wrote. The right answer is for pages not to fight the lock; nothing in the app
 * touches `body.style.overflow` outside this module.
 */
export function lockBodyScroll(): () => void {
  if (scrollLocks === 0) overflowBeforeFirstLock = document.body.style.overflow;
  scrollLocks += 1;
  document.body.style.overflow = "hidden";
  let released = false;

  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = overflowBeforeFirstLock;
  };
}

export function isBodyScrollLocked(): boolean {
  return scrollLocks > 0;
}
