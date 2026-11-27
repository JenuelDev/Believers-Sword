import { app, screen, type BrowserWindow } from 'electron';
import { fitWindowBounds } from './windowBounds';

/** Own temporary window constraints in the main process, including renderer failure. */
export function createImmersiveWindowController(win: BrowserWindow) {
    let originalMinimum: [number, number] | undefined;
    let restoreBounds = false;

    function restoreNormalBounds() {
        if (!restoreBounds || win.isDestroyed() || win.isMaximized() || win.isFullScreen() || win.isMinimized()) return;
        restoreBounds = false;
        const bounds = win.getNormalBounds();
        const area = screen.getDisplayMatching(win.getBounds()).workArea;
        win.setBounds(fitWindowBounds(bounds, area), false);
    }

    function setEnabled(enabled: boolean) {
        if (win.isDestroyed()) return;
        if (enabled) {
            if (!originalMinimum) {
                const [width, height] = win.getMinimumSize();
                originalMinimum = [width, height];
            }
            restoreBounds = false;
            win.setMinimumSize(360, 500);
        } else {
            if (originalMinimum) {
                const minimum = originalMinimum;
                originalMinimum = undefined;
                win.setMinimumSize(...minimum);
                restoreBounds = true;
            }
            // Changing bounds in a maximized/fullscreen/minimized window can
            // change its mode. Fit its restore rectangle when it becomes normal.
            restoreNormalBounds();
        }
    }

    function reset() {
        try { setEnabled(false); } catch { /* Window teardown may already be underway. */ }
    }

    win.webContents.on('did-finish-load', reset);
    win.webContents.on('render-process-gone', reset);
    // Run before the window-state manager persists bounds or close-to-tray hides.
    win.prependListener('close', reset);
    app.prependListener('before-quit', reset);
    win.on('unmaximize', restoreNormalBounds);
    win.on('leave-full-screen', restoreNormalBounds);
    win.on('restore', restoreNormalBounds);
    win.once('closed', () => app.removeListener('before-quit', reset));

    return { setEnabled };
}
