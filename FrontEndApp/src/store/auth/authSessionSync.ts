import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { runPullSync, resetSyncBackoff } from '../../util/Sync/sync';

/** Downloads follow the authenticated session, independently of paid uploads. */
export function createAuthSessionSync(options: {
    isAuthenticated: Ref<boolean>;
    token: Ref<string | null>;
    flushPendingSettings: () => Promise<boolean>;
}) {
    const { isAuthenticated, token, flushPendingSettings } = options;
    const lastSyncAt = ref<string | null>(null);
    let interval: ReturnType<typeof setInterval> | null = null;
    let lastFocusAt = 0;

    async function receive(force = false) {
        const sessionToken = token.value;
        await flushPendingSettings();
        if (!isAuthenticated.value || !sessionToken || sessionToken !== token.value) return;
        if (force) resetSyncBackoff();
        await runPullSync(force);
    }
    function onFocus() {
        if (Date.now() - lastFocusAt < 60_000) return;
        lastFocusAt = Date.now();
        void receive();
    }
    function stop() {
        if (interval !== null) clearInterval(interval);
        interval = null;
        window.removeEventListener('focus', onFocus);
    }
    const stopWatching = watch(
        () => [isAuthenticated.value, token.value] as const,
        ([authenticated, sessionToken]) => {
            stop();
            lastFocusAt = 0;
            if (!window.isElectron || !authenticated || !sessionToken) return;
            void receive(true);
            interval = setInterval(() => { void receive(); }, 5 * 60_000);
            window.addEventListener('focus', onFocus);
        },
        { immediate: true },
    );
    onScopeDispose(() => { stopWatching(); stop(); });

    async function loadLastSyncAt() {
        try {
            const ts = await window.browserWindow.getLastSyncTimestamp();
            lastSyncAt.value = ts && ts !== '0' ? ts : null;
        } catch { /* Best effort while offline. */ }
    }
    return { lastSyncAt, loadLastSyncAt };
}
