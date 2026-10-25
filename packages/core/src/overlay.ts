interface Snapshot {
  inert: string | null;
  hidden: string | null;
}
interface Layer {
  element: HTMLElement;
  priority: number;
}
interface Layers {
  active: Layer[];
  saved: Map<HTMLElement, Snapshot>;
  observer: MutationObserver;
}
const layerKey = Symbol.for("playerstack.overlayLayers");
type LayerRoot = HTMLElement & { [layerKey]?: Layers };

function restore(element: HTMLElement, state: Snapshot): void {
  for (const [name, value] of [
    ["inert", state.inert],
    ["aria-hidden", state.hidden],
  ]) {
    if (value === null) element.removeAttribute(name!);
    else element.setAttribute(name!, value!);
  }
}

function topLayer(state: Layers): Layer | undefined {
  return [...state.active].sort(
    (a, b) => b.priority - a.priority || state.active.indexOf(b) - state.active.indexOf(a),
  )[0];
}

function focusOverlay(overlay: HTMLElement): void {
  const first = [
    ...overlay.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]',
    ),
  ].find((el) => !el.closest("[inert],[hidden]"));
  if (!first) overlay.tabIndex = -1;
  (first || overlay).focus();
}

function update(root: HTMLElement, state: Layers): void {
  for (const [element, snapshot] of state.saved) restore(element, snapshot);
  const top = topLayer(state);
  const covered = new Set<HTMLElement>();
  if (top) {
    let branch: HTMLElement = top.element;
    while (branch !== root && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) covered.add(sibling);
      }
      branch = branch.parentElement;
    }
  }
  for (const element of covered) {
    if (!state.saved.has(element))
      state.saved.set(element, {
        inert: element.getAttribute("inert"),
        hidden: element.getAttribute("aria-hidden"),
      });
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  }
  for (const element of state.saved.keys()) if (!covered.has(element)) state.saved.delete(element);
}

export function focusPlayerControl(container: HTMLElement): void {
  const thumbnail = container.querySelector<HTMLElement>(".playerstack-thumb-play");
  const controller = container.querySelector<HTMLElement>("media-controller");
  const play = controller?.querySelector<HTMLElement>("media-play-button");
  const target = thumbnail || play;
  target?.focus();
  if (!target || container.ownerDocument.activeElement !== target) controller?.focus();
}

export function activateOverlay(
  container: HTMLElement,
  overlay: HTMLElement,
  priority = 3,
  focusFromBody = false,
): () => void {
  let state = (container as LayerRoot)[layerKey];
  if (!state) {
    const observer = new MutationObserver(() => update(container, state!));
    state = { active: [], saved: new Map(), observer };
    (container as LayerRoot)[layerKey] = state;
    observer.observe(container, { childList: true, subtree: true });
  }
  const previous = container.ownerDocument.activeElement;
  const ownsFocus = previous instanceof HTMLElement && container.contains(previous);
  const layer = { element: overlay, priority };
  state.active.push(layer);
  update(container, state);
  if (
    topLayer(state) === layer &&
    (ownsFocus || (focusFromBody && previous === container.ownerDocument.body))
  )
    focusOverlay(overlay);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const focused = overlay.contains(container.ownerDocument.activeElement);
    state!.active = state!.active.filter((entry) => entry !== layer);
    update(container, state!);
    if (!state!.active.length) {
      state!.observer.disconnect();
      delete (container as LayerRoot)[layerKey];
    }
    if (focused) {
      const top = topLayer(state!);
      if (top) focusOverlay(top.element);
      else if (
        ownsFocus &&
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.closest("[inert]")
      )
        previous.focus();
      else focusPlayerControl(container);
    }
  };
}
