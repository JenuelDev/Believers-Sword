<script lang="ts" setup>
import { ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { useSermonStore, SermonType } from '../../store/Sermons';
import { Icon } from '@iconify/vue';
import SermonFeed from './SermonFeed.vue';
import SermonFavorites from './SermonFavorites.vue';
import SermonDetailModal from './SermonDetailModal.vue';

const sermonStore = useSermonStore();

const activeTab = ref<'browse' | 'favorites'>('browse');
const selectedSermon = ref<SermonType | null>(null);
const showDetailModal = ref(false);
const viewDelayMs = 7000;
const viewTimer = ref<ReturnType<typeof setTimeout> | null>(null);

function openDetail(sermon: SermonType) {
    selectedSermon.value = sermon;
    showDetailModal.value = true;
    scheduleSermonView(sermon);
}

function closeDetail() {
    showDetailModal.value = false;
}

function clearSermonViewTimer() {
    if (!viewTimer.value) return;
    clearTimeout(viewTimer.value);
    viewTimer.value = null;
}

function scheduleSermonView(sermon: SermonType) {
    clearSermonViewTimer();
    if (document.hidden) return;

    viewTimer.value = setTimeout(async () => {
        viewTimer.value = null;
        if (document.hidden || !showDetailModal.value || selectedSermon.value?.id !== sermon.id) return;
        await sermonStore.recordSermonView(sermon);
    }, viewDelayMs);
}

function handleVisibilityChange() {
    if (document.hidden) {
        clearSermonViewTimer();
        return;
    }

    if (showDetailModal.value && selectedSermon.value) {
        scheduleSermonView(selectedSermon.value);
    }
}

watch(showDetailModal, (showing) => {
    if (!showing) clearSermonViewTimer();
});

onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
    clearSermonViewTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
    <div class="sermons-root">

        <!-- ═══ PAGE HEADER ═══ -->
        <div class="page-header">
            <div>
                <h1 class="page-title">{{ $t('Sermons') }}</h1>
                <p class="page-subtitle">Browse messages from the community</p>
            </div>
        </div>

        <!-- ═══ TAB BAR ═══ -->
        <div class="tab-bar">
            <button
                class="tab-btn"
                :class="{ active: activeTab === 'browse' }"
                @click="activeTab = 'browse'"
            >
                <Icon icon="mdi:earth" class="mr-1" />Browse
            </button>
            <button
                class="tab-btn"
                :class="{ active: activeTab === 'favorites' }"
                @click="activeTab = 'favorites'"
            >
                <Icon icon="mdi:star" class="mr-1" />Favorites
                <span v-if="sermonStore.favorites.length" class="tab-count">{{ sermonStore.favorites.length }}</span>
            </button>
        </div>

        <!-- Offline / stale banner — visible above the browse tab when the feed is stale. -->
        <div
            v-if="activeTab === 'browse' && (sermonStore.feedStatus === 'staleOffline' || sermonStore.feedStatus === 'staleError')"
            class="stale-banner"
        >
            <Icon :icon="sermonStore.feedStatus === 'staleOffline' ? 'mdi:wifi-off' : 'mdi:cloud-off-outline'" />
            <span>
                {{ sermonStore.feedStatus === 'staleOffline'
                    ? "You're offline — showing saved sermons."
                    : "Couldn't reach the server — showing saved sermons." }}
            </span>
        </div>

        <SermonFeed v-show="activeTab === 'browse'" @open="openDetail" />
        <SermonFavorites v-show="activeTab === 'favorites'" @open="openDetail" />

        <SermonDetailModal :sermon="selectedSermon" :show="showDetailModal" @close="closeDetail" />
    </div>
</template>

<style scoped>
/* ── Root ── */
.sermons-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding-left: 15px;
}

/* ── Header ── */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 0;
    flex-shrink: 0;
}
.page-title {
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 2px;
    line-height: 1.2;
}
.page-subtitle {
    font-size: 12px;
    opacity: 0.5;
    margin: 0;
}

/* ── Tabs ── */
.tab-bar {
    display: flex;
    gap: 2px;
    padding: 10px 20px 0;
    border-bottom: 1px solid var(--theme-border, rgba(255,255,255,0.07));
    flex-shrink: 0;
}
.tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.5;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: opacity 0.15s, border-color 0.15s;
}
.tab-btn:hover { opacity: 0.8; }
.tab-btn.active {
    opacity: 1;
    border-bottom-color: var(--primary-color, #6f84ff);
    color: var(--primary-color, #6f84ff);
}
.tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary-color, #6f84ff) 18%, transparent);
    color: var(--primary-color, #6f84ff);
    font-size: 10px;
    font-weight: 700;
}

.stale-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 16px 0;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.08));
    background: rgba(120, 120, 120, 0.12);
    font-size: 12px;
    color: var(--theme-muted-foreground, #9ca3af);
}
</style>
