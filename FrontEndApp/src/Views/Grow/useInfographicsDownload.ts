import { ref } from 'vue';

export interface InfographicResource {
    title: string;
    category: string;
    fileName: string;
    size: number;
    isPdf: boolean;
    url: string;
}

interface DownloadBridge {
    listInfographics(): Promise<InfographicResource[]>;
    downloadInfographics(): Promise<{ success: boolean; resources?: InfographicResource[]; error?: string }>;
    onInfographicsProgress(callback: (value: { percent: number | null; phase: string }) => void): () => void;
}

/** A single renderer-session job and subscription, independent of page mounts. */
export function createInfographicsDownload(bridge: DownloadBridge) {
    const resources = ref<InfographicResource[]>([]);
    const loading = ref(true);
    const busy = ref(false);
    const percent = ref<number | null>(null);
    const phase = ref('');
    const error = ref('');
    let initialization: Promise<void> | undefined;
    let active: Promise<void> | undefined;
    let unsubscribe: (() => void) | undefined;

    function initialize(): Promise<void> {
        if (initialization) return initialization;
        unsubscribe = bridge.onInfographicsProgress(value => {
            percent.value = value.percent;
            phase.value = value.phase;
        });
        initialization = bridge.listInfographics().then(items => {
            resources.value = items;
        }).catch(() => {
            error.value = 'Could not read the saved collection. Please download it again.';
        }).finally(() => { loading.value = false; });
        return initialization;
    }

    function start(): Promise<void> {
        if (active) return active;
        active = performDownload().finally(() => { active = undefined; });
        return active;
    }

    async function performDownload() {
        busy.value = true;
        percent.value = null;
        phase.value = 'Connecting to GitHub...';
        error.value = '';
        try {
            await initialize();
            error.value = '';
            const result = await bridge.downloadInfographics();
            if (!result.success || !result.resources) throw new Error(result.error || 'Download failed.');
            resources.value = result.resources;
            percent.value = 1;
            phase.value = 'Available offline';
        } catch (failure) {
            error.value = `${failure instanceof Error ? failure.message : 'Download failed.'} Check your connection and available storage, then retry.`;
        } finally {
            busy.value = false;
        }
    }

    return { resources, loading, busy, percent, phase, error, initialize, start,
        dispose: () => unsubscribe?.() };
}

let shared: ReturnType<typeof createInfographicsDownload> | undefined;

export function useInfographicsDownload() {
    return shared ??= createInfographicsDownload(window.browserWindow);
}
