import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { controlsPolicyPlugin } from "@playerstack/plugin-controls-policy";

Playerstack.use(sourcesPlugin).use(controlsPolicyPlugin).define();

// Expose for devtools and E2E tests
(window as unknown as { Playerstack: typeof Playerstack }).Playerstack = Playerstack;

console.log(
  "[playerstack] playground booted with plugins:",
  Playerstack.plugins().map((p) => p.name),
);
