import { definePlayerstackElement } from "./playerstack-element";

export { definePlayerstackElement, PlayerstackElement } from "./playerstack-element";

if (typeof window !== "undefined" && !customElements.get("player-stack")) {
  definePlayerstackElement();
}
