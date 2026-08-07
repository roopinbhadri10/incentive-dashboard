// `isPlugin` is true only when this code runs inside the Salescode shell plugin
// bundle (built via vite.plugin.config.ts, which defines __IS_PLUGIN__ = true).
// Compile-time constant → `if (isPlugin)` / `!isPlugin` branches are tree-shaken
// out of whichever build doesn't need them. Consume via this module, not the
// raw global.
export const isPlugin: boolean =
  typeof __IS_PLUGIN__ !== "undefined" ? __IS_PLUGIN__ : false;
