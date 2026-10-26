type CursorBridge = {
    getSyncSetting: (key: string) => Promise<unknown>;
    setSyncSetting: (key: string, value: any) => Promise<unknown>;
    updateLastSyncTimestamp: (value: string) => Promise<unknown>;
};

/** Recover rows skipped by older timestamp-boundary pagination, once per device. */
export async function healCursorOnce(bridge: CursorBridge): Promise<void> {
    const key = 'cursor_heal_v2';
    if (await bridge.getSyncSetting(key)) return;
    await bridge.updateLastSyncTimestamp('0');
    await bridge.setSyncSetting(key, true);
}
