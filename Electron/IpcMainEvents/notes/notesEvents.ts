import { ipcMain } from 'electron';
import Log from 'electron-log';
import { StoreDB } from '../../DataBase/DataBase';
import { logSyncChange } from '../../DataBase/SyncDB';
import { saveNote, removeNote } from './notePersistence';

export default () => {
    ipcMain.handle('getNotes', async () => StoreDB('notes').orderBy('created_at', 'asc').select());

    ipcMain.handle('upsertNote', async (_event, note: { note_id: string; title: string; content: string }) => {
        try {
            await saveNote(StoreDB, logSyncChange, note);
            return { success: true };
        } catch (error) {
            Log.error('upsertNote error:', error);
            throw error;
        }
    });

    ipcMain.handle('deleteNote', async (_event, { note_id }: { note_id: string }) => {
        try {
            await removeNote(StoreDB, logSyncChange, note_id);
            return { success: true };
        } catch (error) {
            Log.error('deleteNote error:', error);
            throw error;
        }
    });
};
