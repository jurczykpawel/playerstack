import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { controlsPolicyPlugin } from "@playerstack/plugin-controls-policy";

Playerstack.use(sourcesPlugin).use(controlsPolicyPlugin).define();

console.log(
  "[playerstack] playground booted with plugins:",
  Playerstack.plugins().map((p) => p.name),
);
