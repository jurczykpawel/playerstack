// Installs the Sellf config provider. entry.ts imports this module first:
// plugins import @playerstack/core, whose index defines <player-stack> on
// import, and elements already in the page boot with whatever provider is
// installed at that moment.
import { setConfigProviderForElement } from "../../packages/core/src/playerstack-element";
import { createSellfConfigProvider } from "../../packages/plugin-sellf-adapter/src/index";

setConfigProviderForElement(
  createSellfConfigProvider({
    baseUrl: "https://sellf.app",
    // fetchOptions: { credentials: "include" }, // if your endpoint needs cookies
  }),
);
