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
                    :class="{ 'is-coverless': !sermon.thumbnail_url }"
                    @click="emit('open', sermon)"
                >
                    <!-- Cover only when the sermon has one (see SermonFeed.vue). -->
                    <div v-if="sermon.thumbnail_url" class="card-thumb">
                        <img :src="sermon.thumbnail_url" :alt="sermon.title" />
                    </div>
                    <!-- On the card, not the cover, so it survives a coverless card. -->
                    <button
                        type="button"
                        class="card-unfav-btn"
                        title="Remove from favorites"
                        @click.stop="handleToggleFavorite(sermon)"
                    >
                        <Icon icon="mdi:star" width="20" />
                    </button>
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
    /* Anchors .card-unfav-btn, which now sits on the card rather than the cover. */
    position: relative;
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
.card-unfav-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #fbbf24;
    border: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
    z-index: 2;
}
.card-unfav-btn:hover {
    background: rgba(0, 0, 0, 0.78);
    transform: scale(1.05);
}
/* With no cover behind it the solid dark pill reads as a blob on the card. */
.sermon-card.is-coverless .card-unfav-btn {
    background: transparent;
}
.sermon-card.is-coverless .card-unfav-btn:hover {
    background: var(--theme-bg-elevated, rgba(127, 127, 127, 0.14));
}
.sermon-card.is-coverless .card-title {
    padding-right: 34px;
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
