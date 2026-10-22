import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fitWindowBounds, isRectangle, type WindowState } from './windowBounds';

let currentWindow: BrowserWindow | null = null;
let currentState: WindowState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let hasShown = false;

function statePath() {
    return path.join(app.getPath('userData'), 'window-state.json');
}

/** Reads the legacy file too, without discarding partially offscreen windows. */
export function createWindowState(): WindowState {
    let saved: Partial<WindowState> = {};
    try {
        const value: unknown = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
        if (value && typeof value === 'object') saved = value as Partial<WindowState>;
    } catch {
        // First launch or a damaged file uses safe bounds on the primary screen.
    }

    const previousArea = isRectangle(saved.displayWorkArea) ? saved.displayWorkArea :
        isRectangle(saved.displayBounds) ? saved.displayBounds : undefined;
    const hasSavedBounds = isRectangle(saved);
    const displays = screen.getAllDisplays();
    const display = !hasSavedBounds ? screen.getPrimaryDisplay() :
        displays.find(item => item.id === saved.displayId) ||
        (previousArea ? screen.getDisplayMatching(previousArea) :
            isRectangle(saved) ? screen.getDisplayMatching(saved) : screen.getPrimaryDisplay());
    const area = display.workArea;
    const defaultBounds = {
        x: Math.round(area.x + Math.max(0, area.width - 1280) / 2),
        y: Math.round(area.y + Math.max(0, area.height - 800) / 2),
        width: 1280,
        height: 800,
    };
    const bounds = isRectangle(saved)
        ? fitWindowBounds(saved, area, previousArea)
        : fitWindowBounds(defaultBounds, area);
    return {
        ...bounds,
        isMaximized: hasSavedBounds && saved.isMaximized === true,
        isFullScreen: !hasSavedBounds || saved.isFullScreen === true,
        displayId: display.id,
        displayBounds: display.bounds,
        displayWorkArea: area,
    };
}

function captureWindowState() {
    const win = currentWindow;
    // Startup restores maximize/fullscreen after show(). Do not overwrite that
    // saved state while the main window is still hidden behind the splash.
    if (!win || win.isDestroyed() || !hasShown || win.isMinimized()) return;
    const display = screen.getDisplayMatching(win.getBounds());
    const normal = win.getNormalBounds();
    const normalDisplay = screen.getDisplayMatching(normal);
    // Windows can retain normal bounds on the old monitor after Win+Shift+Arrow
    // moves a maximized window. Anchor its restore rectangle to the live monitor.
    const bounds = fitWindowBounds(normal, display.workArea,
        normalDisplay.id === display.id ? undefined : normalDisplay.workArea);
    currentState = {
        ...bounds,
        isMaximized: win.isMaximized(),
        isFullScreen: win.isFullScreen(),
        displayId: display.id,
        displayBounds: display.bounds,
        displayWorkArea: display.workArea,
    };
}

function persistWindowState() {
    if (!currentState || !hasShown) return;
    try {
        const destination = statePath();
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination + '.tmp', JSON.stringify(currentState));
        fs.renameSync(destination + '.tmp', destination);
    } catch (error) {
        console.warn('[Window] Could not save window placement', error);
    }
}

function queueWindowStateSave() {
    captureWindowState();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        captureWindowState();
        persistWindowState();
    }, 150);
}

export function attachWindowStateManager(win: BrowserWindow, windowState: WindowState) {
    if (saveTimer) clearTimeout(saveTimer);
    currentWindow = win;
    currentState = windowState;
    hasShown = false;
    win.once('show', () => {
        // Let revealMainWindow apply the saved mode in the same turn first.
        setImmediate(() => {
            if (currentWindow !== win || win.isDestroyed()) return;
            hasShown = true;
            saveWindowState();
        });
    });
    win.on('move', queueWindowStateSave);
    win.on('resize', queueWindowStateSave);
    win.on('maximize', queueWindowStateSave);
    win.on('unmaximize', queueWindowStateSave);
    win.on('enter-full-screen', queueWindowStateSave);
    win.on('leave-full-screen', queueWindowStateSave);
    win.on('restore', queueWindowStateSave);
    // Persist at the end of Windows drag/resize, and before close-to-tray hides.
    win.on('moved', saveWindowState);
    win.on('resized', saveWindowState);
    win.on('hide', saveWindowState);
    win.on('close', saveWindowState);
    win.once('closed', () => {
        if (currentWindow !== win) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = undefined;
        persistWindowState();
        currentWindow = null;
        currentState = null;
        hasShown = false;
    });
}

/** Flushes to disk for quit/update and completed native window moves. */
export function saveWindowState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    captureWindowState();
    persistWindowState();
}
