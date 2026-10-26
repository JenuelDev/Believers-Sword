type PullPageBridge = {
    applyPullData: (page: any) => Promise<{ success?: boolean; error?: string }>;
    updateLastSyncTimestamp: (timestamp: string) => Promise<unknown>;
};

/** Cursor advancement is conditional on successful local persistence. */
export async function applyPullPage(bridge: PullPageBridge, page: any): Promise<void> {
    const result = await bridge.applyPullData(page);
    if (!result?.success) throw new Error(result?.error || 'Could not save downloaded changes.');
    if (!page.has_more && page.last_sync_timestamp) {
        await bridge.updateLastSyncTimestamp(page.last_sync_timestamp);
    }
}
