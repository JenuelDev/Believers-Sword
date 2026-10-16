import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { download } from 'electron-dl';
import Log from 'electron-log';
import { collectionDirectory, INFOGRAPHICS_VERSION, INFOGRAPHICS_ZIP_URL,
    InfographicResource, RESOURCE_EXTENSIONS, resourceMetadata, validateResourcePath } from './infographicPaths';
import { extractInfographics } from './infographicArchive';

export function registerInfographicsScheme(): void {
    protocol.registerSchemesAsPrivileged([{
        scheme: 'infographics',
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    }]);
}

export function registerInfographicsProtocol(): void {
    protocol.handle('infographics', async request => {
        try {
            const url = new URL(request.url);
            if (url.hostname !== 'collection') return new Response('Not found', { status: 404 });
            const name = decodeURIComponent(url.pathname.slice(1));
            validateResourcePath(name);
            const extension = path.extname(name).toLowerCase();
            if (!RESOURCE_EXTENSIONS.has(extension)) return new Response('Not found', { status: 404 });
            const file = path.join(collectionDirectory(app.getPath('userData')), name);
            const data = await fs.readFile(file);
            const mime: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png',
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
            return new Response(new Uint8Array(data), { headers: {
                'content-type': mime[extension], 'access-control-allow-origin': '*',
            } });
        } catch {
            return new Response('Not found', { status: 404 });
        }
    });
}

async function listResources(): Promise<InfographicResource[]> {
    const directory = collectionDirectory(app.getPath('userData'));
    try {
        const rows = JSON.parse(await fs.readFile(path.join(directory, 'catalog.json'), 'utf8')) as InfographicResource[];
        const result: InfographicResource[] = [];
        for (const row of rows) {
            validateResourcePath(row.fileName);
            try {
                const stat = await fs.stat(path.join(directory, row.fileName));
                if (stat.isFile() && stat.size === row.size) result.push(resourceMetadata(row.fileName, row.size));
            } catch { /* Missing files trigger a fresh installation in the renderer. */ }
        }
        return result.length === rows.length ? result : [];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') Log.warn('[Infographics] Could not read catalog', error);
        return [];
    }
}

let installing: Promise<{ success: boolean; resources?: InfographicResource[]; error?: string }> | null = null;

export function InfographicsEvents(window: BrowserWindow): void {
    ipcMain.removeHandler('infographics:list');
    ipcMain.removeHandler('infographics:download');
    ipcMain.handle('infographics:list', listResources);
    ipcMain.handle('infographics:download', () => {
        if (installing) return installing;
        installing = install(window).finally(() => { installing = null; });
        return installing;
    });
}

async function install(window: BrowserWindow) {
    const destination = collectionDirectory(app.getPath('userData'));
    const root = path.dirname(destination);
    const zipPath = path.join(root, `collection-${INFOGRAPHICS_VERSION}.zip`);
    const progress = (percent: number | null, phase: string) => {
        if (!window.isDestroyed()) window.webContents.send('infographics:progress', { percent, phase });
    };
    try {
        await fs.mkdir(root, { recursive: true });
        progress(null, 'Connecting to GitHub...');
        await download(window, INFOGRAPHICS_ZIP_URL, {
            directory: root,
            filename: path.basename(zipPath),
            overwrite: true,
            saveAs: false,
            openFolderWhenDone: false,
            onProgress: state => progress(state.percent, `Downloading ${(state.transferredBytes / 1024 / 1024).toFixed(1)} MB of ${(state.totalBytes / 1024 / 1024).toFixed(1)} MB`),
        });
        progress(null, 'Extracting images and PDFs...');
        const resources = await extractInfographics(zipPath, destination);
        await fs.rm(zipPath, { force: true });
        return { success: true, resources };
    } catch (error) {
        Log.error('[Infographics] Download failed', error);
        await fs.rm(zipPath, { force: true }).catch(() => {});
        return { success: false, error: error instanceof Error ? error.message : 'Could not download the collection.' };
    }
}
