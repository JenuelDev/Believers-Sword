<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { useSermonStore, SermonType } from '../../store/Sermons';
import { Icon } from '@iconify/vue';

const emit = defineEmits<{
    (e: 'open', sermon: SermonType): void;
}>();

const sermonStore = useSermonStore();
const message = useMessage();

async function handleToggleFavorite(sermon: SermonType) {
    const ok = await sermonStore.toggleFavorite(sermon);
    if (!ok) message.error("Couldn't update favorites. Please try again.");
}
</script>

<template>
    <div class="tab-content">
        <div v-if="!sermonStore.favorites.length" class="empty-state">
            <Icon icon="mdi:star-outline" class="empty-icon" />
            <p class="empty-title">No favorites yet</p>
            <p class="empty-sub">Tap the star on a sermon to save it here for offline reading.</p>
        </div>
        <div v-else class="sermon-grid-scroll">
            <div class="sermon-grid">
                <div
                    v-for="sermon in sermonStore.favorites"
                    :key="sermon.id"
                    class="sermon-card"
                    @click="emit('open', sermon)"
                >
                    <div class="card-thumb">
                        <img v-if="sermon.thumbnail_url" :src="sermon.thumbnail_url" :alt="sermon.title" />
                        <div v-else class="card-thumb-placeholder">
                            <Icon icon="mdi:book-cross" class="text-4xl opacity-30" />
                        </div>
                        <button
                            type="button"
                            class="absolute top-1 right-1 w-32px h-32px rounded-full bg-black/55 flex items-center justify-center text-yellow-400 hover:bg-black/75"
                            title="Remove from favorites"
                            @click.stop="handleToggleFavorite(sermon)"
                        >
                            <Icon icon="mdi:star" width="20" />
                        </button>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">{{ sermon.title }}</h3>
                        <p class="card-summary">{{ sermon.summary }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ── Tab content wrapper ── */
.tab-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 12px 16px 0;
}

/* ── Scrollable area ── */
.sermon-grid-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 4px 16px;
}
.sermon-grid-scroll::-webkit-scrollbar { width: 4px; }
.sermon-grid-scroll::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255,255,255,0.16)); border-radius: 4px; }

/* ── Sermon grid ── */
.sermon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
}

/* ── Sermon card ── */
.sermon-card {
    border-radius: 14px;
    overflow: hidden;
    background: var(--theme-bg-soft, rgba(255,255,255,0.04));
    border: 1px solid var(--theme-border, rgba(255,255,255,0.07));
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
    display: flex;
    flex-direction: column;
}
.sermon-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    background: var(--theme-bg-elevated, rgba(255,255,255,0.07));
}
.card-thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    position: relative;
    overflow: hidden;
    background: var(--theme-bg-elevated, rgba(255,255,255,0.05));
    flex-shrink: 0;
}
.card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s;
}
.sermon-card:hover .card-thumb img { transform: scale(1.04); }
.card-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(111,132,255,0.1), rgba(95,176,255,0.06));
}
.card-body {
    padding: 12px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.card-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.card-summary {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
}

/* ── Empty state ── */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    opacity: 0.6;
}
.empty-icon { font-size: 52px; opacity: 0.5; }
.empty-title { font-size: 16px; font-weight: 700; margin: 0; }
.empty-sub { font-size: 13px; margin: 0; text-align: center; max-width: 280px; opacity: 0.7; }
</style>
