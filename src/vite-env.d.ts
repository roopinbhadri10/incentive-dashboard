/// <reference types="vite/client" />

// Injected by the two Vite configs' `define` blocks:
//   vite.config.ts        → false (standalone SPA)
//   vite.plugin.config.ts → true  (shell plugin bundle)
// Consume through `@/config/is-plugin`, never directly.
declare const __IS_PLUGIN__: boolean;
