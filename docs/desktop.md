# Desktop reader

The Electron app has an immersive Scripture reader, opened with the focus button in the Bible reader toolbar. It starts with the first selected translation and the current book and chapter. It is unavailable on the web.

- `FrontEndApp/src/Views/ReadBible/ImmersiveReader/ImmersiveReader.vue` owns the overlay, native text selection and copy, focus, and keyboard shortcuts. Listeners exist only while open. The visible Leave reader button and Escape return to the normal reader.
- `FrontEndApp/src/store/immersiveReaderStore.ts` loads chapters independently of the main reader, ignores stale responses, preserves verse line breaks, and saves text size in local storage. A hidden deuterocanonical book remains navigable when it is the starting book. No translation selected produces an unavailable state without Bible service calls.
- `Electron/util/immersiveWindow.ts` temporarily lowers the main window minimum to 360 by 500, then restores its original minimum. Reload, renderer failure, close, and quit also reset it. Normal bounds are fitted to the current display, with fitting deferred until restore for maximized, fullscreen, or minimized windows. Window-state persistence also fits saved bounds through `Electron/util/windowBounds.ts`.

Left and Right change chapters. Up and Down scroll, while Space, Shift+Space, PageUp, and PageDown scroll by a page. Home and End move to the beginning or end. Plus and minus change text size. Holding Ctrl or Cmd displays the shortcut sheet; navigation still works while it is held. Ctrl/Cmd+A selects the reading surface, and Ctrl/Cmd+C copies the native selection. Tab focuses the exit button.

Book names use the existing translations. Labels use the `immersive` translation namespace with English fallback for languages that have not supplied these labels yet.

Run the focused regression tests with `node --test Electron/util/immersiveWindow.test.cjs FrontEndApp/src/store/immersiveReaderStore.test.cjs FrontEndApp/src/Views/ReadBible/ImmersiveReader/ImmersiveReader.test.cjs`. Run `node node_modules/electron/cli.js scripts/verify-immersive-reader.cjs` for a hidden Chromium smoke test of DOM line breaks, selection, focus, and narrow/desktop rendering. The smoke test uses a temporary Electron profile and writes screenshots to a temporary directory.
