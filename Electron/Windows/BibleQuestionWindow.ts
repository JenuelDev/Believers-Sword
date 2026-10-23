import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { isBeta, isDev } from '../config';
import { appIconPath } from '../util/appIcon';
import { resolveTheme as resolveSplashTheme } from './SplashWindow';

const WINDOW_WIDTH = 760;
const WINDOW_HEIGHT = 820;
const CASCADE_STEP = 28;

interface BibleQuestionWindowArgs {
    id: number;
    question: string;
    category: string;
    answer_count: number;
}

/** One window per question: opening the same question again focuses it. */
const openWindows = new Map<number, BrowserWindow>();

/**
 * Center over the window that opened it (same monitor), cascading each extra
 * open question so windows don't stack exactly, clamped to the work area.
 */
function boundsOverParent(parent: BrowserWindow | null) {
    if (!parent || parent.isDestroyed()) return undefined;
    const pb = parent.getBounds();
    const { workArea } = screen.getDisplayMatching(pb);
    const width = Math.min(WINDOW_WIDTH, workArea.width);
    const height = Math.min(WINDOW_HEIGHT, workArea.height);
    const offset = (openWindows.size % 6) * CASCADE_STEP;
    const x = Math.round(pb.x + (pb.width - width) / 2) + offset;
    const y = Math.round(pb.y + (pb.height - height) / 2) + offset;
    return {
        width,
        height,
        x: Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width)),
        y: Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height)),
    };
}

export const BibleQuestionWindowEvents = () => {
    ipcMain.handle('bibleQuestions:openWindow', async (event, args: BibleQuestionWindowArgs) => {
        const id = Math.floor(Number(args?.id));
        if (!Number.isFinite(id) || id < 1) return;

        const existing = openWindows.get(id);
        if (existing && !existing.isDestroyed()) {
            if (existing.isMinimized()) existing.restore();
            existing.focus();
            return;
        }

        const bounds = boundsOverParent(BrowserWindow.fromWebContents(event.sender));
        const win = new BrowserWindow({
            width: bounds?.width ?? WINDOW_WIDTH,
            height: bounds?.height ?? WINDOW_HEIGHT,
            x: bounds?.x,
            y: bounds?.y,
            minWidth: 420,
            minHeight: 480,
            frame: false,
            resizable: true,
            title: String(args.question || 'Bible Question'),
            icon: appIconPath(),
            // The page's --theme-bg-main, saved for the splash, so there is no white flash.
            backgroundColor: resolveSplashTheme().bg,
            webPreferences: {
                preload: path.join(__dirname, '../preload.js'),
                devTools: isDev || isBeta,
            },
            show: false,
        });
        openWindows.set(id, win);
        win.on('closed', () => openWindows.delete(id));

        // The summary rides in the query so the header renders before answers load.
        const query = [
            `id=${id}`,
            `question=${encodeURIComponent(String(args.question ?? ''))}`,
            `category=${encodeURIComponent(String(args.category ?? ''))}`,
            `answers=${Math.max(0, Math.floor(Number(args.answer_count) || 0))}`,
        ].join('&');
        const url = isDev
            ? `http://localhost:3000/#/bible-question?${query}`
            // Compiled to dist/Windows/; index.html sits at the dist root.
            : `file://${path.join(__dirname, '..', 'index.html')}#/bible-question?${query}`;

        // Show at first paint rather than after the whole page has loaded.
        win.once('ready-to-show', () => {
            if (!win.isDestroyed()) win.show();
        });
        await win.loadURL(url);
    });
};
