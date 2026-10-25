import { afterEach, expect, it, vi } from "vitest";
import { activateOverlay } from "./overlay";
afterEach(() => {
  document.body.innerHTML = "";
});
for (const reverse of [false, true]) {
  it(`restores nested layers in either closing order (${reverse})`, () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div aria-hidden="false"></div><div inert aria-hidden="true"></div><section><button>A</button></section>';
    document.body.append(root);
    const [controls, held, first] = [...root.children] as [HTMLElement, HTMLElement, HTMLElement];
    const releaseFirst = activateOverlay(root, first);
    expect(controls.hasAttribute("inert")).toBe(true);
    expect(controls.getAttribute("aria-hidden")).toBe("true");
    const second = document.createElement("section");
    second.innerHTML = "<button>B</button>";
    root.append(second);
    const releaseSecond = activateOverlay(root, second);
    expect(first.hasAttribute("inert")).toBe(true);
    if (reverse) {
      releaseFirst();
      first.remove();
      releaseSecond();
    } else {
      releaseSecond();
      second.remove();
      expect(first.hasAttribute("inert")).toBe(false);
      releaseFirst();
    }
    expect(controls.hasAttribute("inert")).toBe(false);
    expect(controls.getAttribute("aria-hidden")).toBe("false");
    expect(held.hasAttribute("inert")).toBe(true);
    expect(held.getAttribute("aria-hidden")).toBe("true");
    releaseFirst();
    releaseSecond();
  });
}
it("moves owned focus into overlay and restores it on release without stealing outside focus", () => {
  const root = document.createElement("div");
  root.innerHTML = "<button>Play</button><section><button>CTA</button></section>";
  document.body.append(root);
  const play = root.querySelector("button")!;
  const overlay = root.querySelector("section")!;
  play.focus();
  const release = activateOverlay(root, overlay);
  expect(document.activeElement).toBe(overlay.firstChild);
  release();
  expect(document.activeElement).toBe(play);
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const close = activateOverlay(root, overlay);
  expect(document.activeElement).toBe(outside);
  close();
  expect(document.activeElement).toBe(outside);
});

it("can claim body focus after a player interaction but leaves an external button alone", () => {
  const root = document.createElement("div");
  root.innerHTML = "<button>Play</button><section><button>CTA</button></section>";
  document.body.append(root);
  const overlay = root.querySelector("section")!;
  const close = activateOverlay(root, overlay, 3, true);
  expect(document.activeElement).toBe(overlay.firstChild);
  close();
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const closeAgain = activateOverlay(root, overlay, 3, true);
  expect(document.activeElement).toBe(outside);
  closeAgain();
});

it("a lower-priority overlay never steals focus from the top layer", () => {
  const root = document.createElement("div");
  root.innerHTML = "<button>Play</button><section><button>Gate</button></section>";
  document.body.append(root);
  const gate = root.querySelector("section")!;
  const gateButton = gate.querySelector("button")!;
  root.querySelector("button")!.focus();
  const releaseGate = activateOverlay(root, gate, 4);
  const cta = document.createElement("section");
  cta.innerHTML = "<button>CTA</button>";
  root.append(cta);
  const releaseCta = activateOverlay(root, cta, 3);
  expect(cta.hasAttribute("inert")).toBe(true);
  expect(document.activeElement).toBe(gateButton);
  releaseGate();
  gate.remove();
  expect(document.activeElement).toBe(cta.firstChild);
  releaseCta();
});

it("shares layer ownership across separately loaded modules", async () => {
  const root = document.createElement("div");
  root.innerHTML =
    "<button>Play</button><section><button>A</button></section><section><button>B</button></section>";
  document.body.append(root);
  const [play, first, second] = [...root.children] as [HTMLElement, HTMLElement, HTMLElement];
  const releaseFirst = activateOverlay(root, first);
  vi.resetModules();
  const other = await import("./overlay");
  const releaseSecond = other.activateOverlay(root, second, 4);
  releaseFirst();
  first.remove();
  expect(play.hasAttribute("inert")).toBe(true);
  expect(second.hasAttribute("inert")).toBe(false);
  releaseSecond();
  expect(play.hasAttribute("inert")).toBe(false);
});
