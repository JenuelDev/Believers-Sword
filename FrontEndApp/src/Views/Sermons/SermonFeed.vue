<script lang="ts" setup>
import { NButton, NInput, NSelect, NSpin, useMessage } from 'naive-ui';
import { computed, ref } from 'vue';
import { useSermonStore, SermonType } from '../../store/Sermons';
import { useInfiniteScroll } from '@vueuse/core';
import { DAYJS } from '../../util/dayjs';
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

const browseEl = ref<HTMLElement | null>(null);

useInfiniteScroll(browseEl as any, () => {
    if (sermonStore.hasMore && !sermonStore.loading) sermonStore.page++;
}, { distance: 120 });

const sortOptions = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Oldest', value: 'oldest' },
];

function selectTopic(topic: string) {
    sermonStore.topicFilter = topic;
    sermonStore.getSermons(true);
}

function formatDate(d: string | null) {
    if (!d) return '';
    return DAYJS(d).format('MMM D, YYYY');
}

function formatDuration(seconds: number | null) {
    if (!seconds || seconds <= 0) return '';
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${totalMinutes} min`;
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

// The empty-state message differentiates "nothing published yet" from the two
// offline/error cases feedStatus can report once a fetch has actually run.
const emptyState = computed(() => {
    if (sermonStore.feedStatus === 'emptyOffline') {
        return {
            icon: 'mdi:wifi-off',
            title: "You're offline",
            sub: 'No saved sermons match right now. Connect to the internet to browse the full catalog.',
        };
    }
    if (sermonStore.feedStatus === 'emptyError') {
        return {
            icon: 'mdi:cloud-off-outline',
            title: "Couldn't load sermons",
            sub: 'Something went wrong reaching the server. Please try again in a moment.',
        };
    }
    if (sermonStore.search || sermonStore.topicFilter) {
        return {
            icon: 'mdi:magnify',
            title: 'No sermons match',
            sub: 'Try a different search term or clear the topic filter.',
        };
    }
    return {
        icon: 'mdi:book-open-blank-variant-outline',
        title: 'No sermons yet',
        sub: 'Check back soon for new messages.',
    };
});
</script>

<template>
    <div class="tab-content">
        <!-- Toolbar -->
        <div class="browse-toolbar">
            <NInput
                v-model:value="sermonStore.search"
                placeholder="Search sermons…"
                size="small"
                clearable
                class="browse-search"
                @keydown.enter="sermonStore.getSermons(true)"
            >
                <template #prefix><Icon icon="mdi:magnify" class="opacity-50" /></template>
            </NInput>
            <NButton size="small" type="primary" ghost @click="sermonStore.getSermons(true)" :loading="sermonStore.loading">
                Search
            </NButton>
            <NSelect
                v-model:value="sermonStore.sort"
                :options="sortOptions"
                size="small"
                class="!w-150px"
                @update:value="sermonStore.getSermons(true)"
            />
            <NButton
                size="small"
                secondary
                :loading="sermonStore.loading"
                @click="sermonStore.getSermons(true)"
            >
                <template #icon><Icon icon="mdi:refresh" /></template>
            </NButton>
        </div>

        <!-- Topic pills -->
        <div class="category-pills" v-if="sermonStore.topics.length">
            <button
                class="cat-pill"
                :class="{ active: sermonStore.topicFilter === '' }"
                @click="selectTopic('')"
            >All</button>
            <button
                v-for="topic in sermonStore.topics"
                :key="topic"
                class="cat-pill"
                :class="{ active: sermonStore.topicFilter === topic }"
                @click="selectTopic(topic)"
            >{{ topic }}</button>
        </div>

        <!-- Sermon grid -->
        <div ref="browseEl" class="sermon-grid-scroll">

            <!-- Initial loading -->
            <div v-if="sermonStore.loading && !sermonStore.sermons.length" class="empty-state">
                <NSpin size="large" />
            </div>

            <!-- Empty -->
            <div v-else-if="!sermonStore.loading && !sermonStore.sermons.length" class="empty-state">
                <Icon :icon="emptyState.icon" class="empty-icon" />
                <p class="empty-title">{{ emptyState.title }}</p>
                <p class="empty-sub">{{ emptyState.sub }}</p>
            </div>

            <!-- Cards -->
            <div v-else class="sermon-grid">
                <div
                    v-for="sermon in sermonStore.sermons"
                    :key="sermon.id"
                    class="sermon-card"
                    @click="emit('open', sermon)"
                >
                    <!-- Thumbnail -->
                    <div class="card-thumb">
                        <img v-if="sermon.thumbnail_url" :src="sermon.thumbnail_url" :alt="sermon.title" />
                        <div v-else class="card-thumb-placeholder">
                            <Icon icon="mdi:book-cross" class="text-4xl opacity-30" />
                        </div>
                        <span v-if="sermon.featured" class="card-cat-badge card-featured-badge">Featured</span>
                        <div v-if="formatDuration(sermon.duration_seconds)" class="card-media-badge">
                            {{ formatDuration(sermon.duration_seconds) }}
                        </div>
                        <button
                            type="button"
                            class="card-fav-btn"
                            :class="{ active: sermonStore.isFavorite(sermon.id) }"
                            :title="sermonStore.isFavorite(sermon.id) ? 'Remove from favorites' : 'Add to favorites'"
                            @click.stop="handleToggleFavorite(sermon)"
                        >
                            <Icon :icon="sermonStore.isFavorite(sermon.id) ? 'mdi:star' : 'mdi:star-outline'" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="card-body">
                        <h3 class="card-title">{{ sermon.title }}</h3>
                        <p class="card-summary">{{ sermon.summary }}</p>
                        <div class="card-meta">
                            <span>{{ sermon.speaker_name }}</span>
                            <span v-if="sermon.preached_at || sermon.published_at">
                                <Icon icon="mdi:calendar-blank-outline" class="inline mr-0.5" />
                                {{ formatDate(sermon.preached_at || sermon.published_at) }}
                            </span>
                            <span>
                                <Icon icon="mdi:eye-outline" class="inline mr-0.5" />
                                {{ sermon.view_count }}
                            </span>
                        </div>
                        <div v-if="sermon.topics?.length" class="card-tags">
                            <span v-for="topic in sermon.topics.slice(0, 3)" :key="topic" class="card-tag">{{ topic }}</span>
                        </div>
                    </div>
                </div>

                <!-- Load-more spinner -->
                <div v-if="sermonStore.loading" class="col-span-full flex justify-center py-4">
                    <NSpin size="small" />
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

/* ── Toolbar ── */
.browse-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
    flex-wrap: wrap;
}
.browse-search { flex: 1; min-width: 180px; max-width: 320px; }

/* ── Topic pills ── */
.category-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}
.cat-pill {
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: var(--theme-bg-soft, rgba(255,255,255,0.06));
    border: 1px solid var(--theme-border, rgba(255,255,255,0.1));
    color: inherit;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
}
.cat-pill:hover { background: var(--theme-bg-elevated, rgba(255,255,255,0.1)); }
.cat-pill.active {
    background: color-mix(in srgb, var(--primary-color, #6f84ff) 20%, transparent);
    border-color: color-mix(in srgb, var(--primary-color, #6f84ff) 60%, transparent);
    color: var(--primary-color, #6f84ff);
}

/* ── Scrollable area ── */
.sermon-grid-scroll {
    flex: 1;
    overflow-y: auto;
    /* Breathing room so the cards' hover lift + shadow aren't clipped by the
       scroll container's edges (overflow-y:auto also clips the x-axis). */
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
.card-cat-badge {
    position: absolute;
    top: 8px;
    left: 8px;
}
.card-featured-badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(216, 162, 58, 0.9);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}
.card-media-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
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
.card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 11px;
    opacity: 0.55;
    margin-top: 4px;
}
.card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.card-tag {
    font-size: 11px;
    opacity: 0.55;
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

.card-fav-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #ffffff;
    border: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.15s ease, transform 0.15s ease;
    z-index: 2;
}
.card-fav-btn:hover {
    background: rgba(0, 0, 0, 0.78);
    transform: scale(1.05);
}
.card-fav-btn.active {
    color: #fbbf24;
}
</style>
