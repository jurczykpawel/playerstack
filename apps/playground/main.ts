import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";

Playerstack.use(sourcesPlugin).define();

console.log("[playerstack] playground booted with plugins:", Playerstack.plugins().map((p) => p.name));
