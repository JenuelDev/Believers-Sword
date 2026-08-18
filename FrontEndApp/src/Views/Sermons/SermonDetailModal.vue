<script lang="ts" setup>
import { NButton, NModal, NSpin, NTag } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import {
    SermonType, ScriptureRef, scriptureRefLabel, sermonSeriesLabel, useSermonStore,
} from '../../store/Sermons';
import { useBibleStore } from '../../store/BibleStore';
import { useModuleStore } from '../../store/moduleStore';
import { Icon } from '@iconify/vue';
import { bible } from '../../util/modules';
import { renderMarkdown } from '../../util/markdown';
import { DAYJS } from '../../util/dayjs';

const props = defineProps<{
    sermon: SermonType | null;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const sermonStore = useSermonStore();
const bibleStore = useBibleStore();
const moduleStore = useModuleStore();

// ── Body hydration ───────────────────────────────────────────────────────────
// Feed/favorites rows come from the card-columns projection and have
// content === null. `hydrated` holds the fully-loaded sermon (content,
// content_format, video/audio urls, scripture_refs — none of which are in the
// card projection) once fetched. Left null on a failed/offline fetch so the
// "not available offline" message shows instead of a blank panel.
const hydrated = ref<SermonType | null>(null);
const hydrating = ref(false);
// A stub favorite with no slug (and no id-based match either) — distinct from
// "not available offline" so a fully-online user isn't told to blame the
// network for a sermon that simply doesn't resolve (e.g. unpublished/deleted
// server-side).
const notFound = ref(false);

function handleUpdateShow(value: boolean) {
    if (!value) emit('close');
}

watch(
    () => [props.sermon, props.show] as const,
    async ([sermon, show]) => {
        if (!show || !sermon) {
            hydrated.value = null;
            hydrating.value = false;
            notFound.value = false;
            resetScriptureState();
            return;
        }

        resetScriptureState();
        notFound.value = false;

        if (sermon.content) {
            hydrated.value = sermon;
            loadSermonScripture(sermon);
            return;
        }

        hydrated.value = null;
        hydrating.value = true;
        // A favorite stub can arrive with no slug yet (pulled from another
        // device, or hydration hasn't run) — fetchBySlug('') would build
        // `slug=eq.undefined`/`slug=eq.` and always return [], so fall back to
        // an id-based fetch instead.
        const full = sermon.slug
            ? await sermonStore.fetchBySlug(sermon.slug)
            : sermon.id
                ? await sermonStore.fetchById(sermon.id)
                : null;
        // The modal may have closed or moved on to a different sermon while
        // the fetch was in flight — ignore a now-stale response.
        if (!props.show || props.sermon !== sermon) return;
        hydrating.value = false;
        if (full) {
            hydrated.value = full;
            loadSermonScripture(full);
        } else if (!sermon.slug) {
            notFound.value = true;
        }
    },
    { immediate: true },
);

function formatDate(d: string | null) {
    if (!d) return '';
    return DAYJS(d).format('MMM D, YYYY');
}

function viewLabel(count: number | null | undefined) {
    const n = count ?? 0;
    return `${n.toLocaleString()} ${n === 1 ? 'view' : 'views'}`;
}

function speakerInitials(name: string | undefined): string {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ── Scripture summary label ──────────────────────────────────────────────────
// `primary_scripture` is a plain string present even on a card row, so it
// shows immediately. `scripture_refs` (structured, per-reference) only arrives
// once the body is hydrated — once it does, it replaces the plain string with
// the fuller per-reference breakdown.
const scriptureRefsList = computed<ScriptureRef[]>(() => hydrated.value?.scripture_refs ?? []);
const scriptureLabelText = computed(
    () => scriptureRefsList.value.length > 0 || !!props.sermon?.primary_scripture,
);

const seriesLabel = computed(() => (props.sermon ? sermonSeriesLabel(props.sermon) : ''));

// ── Scripture verse preview ──────────────────────────────────────────────────
const scriptureLoading = ref(false);
type ScriptureVerseVersion = {
    version: string;
    versionCode: string;
    text: string;
};
type ScriptureVerseGroup = {
    key: string;
    refLabel: string;
    versions: ScriptureVerseVersion[];
};
const scriptureVerseGroups = ref<ScriptureVerseGroup[]>([]);
const scriptureVersionIndexes = ref<Record<string, number>>({});
let scriptureLoadToken = 0;

function resetScriptureState() {
    scriptureLoadToken += 1;
    scriptureLoading.value = false;
    scriptureVerseGroups.value = [];
    scriptureVersionIndexes.value = {};
}

function hasVisibleText(html: string) {
    return html.replace(/<[^>]*>/g, '').trim().length > 0;
}

// Strip MyBible code-style markup (Strong's numbers, morphology, footnotes,
// annotations) so the sermon dialog shows clean prose. Keeps formatting tags
// like <J>, <i>, <e>, <br/>.
function cleanScriptureHtml(html: string) {
    return html
        .replace(/<(S|m|n|f)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<(S|m|n|f)\b[^>]*\/>/gi, '')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function versionShortCode(fileName: string) {
    const installed = moduleStore.bibleLists.find((item: any) => item.file_name === fileName);
    const meta = bible.find((item) => item.file_name === fileName);
    const shortCode = installed?.short_name || meta?.version_short_name_and_date;

    if (shortCode) return shortCode;

    return fileName
        .replace(/\.(SQLite3|sqlite3|db)$/i, '')
        .replace(/^ph4_mybible_/i, '')
        .replace(/^ebible-/i, '')
        .split(/[\s_-]+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 10)
        .toUpperCase();
}

// A ref only yields verses when it resolved to a real book number, chapter and
// starting verse — an unrecognised book name (bookNumber === null) or a
// chapterless/whole-book reference degrades to plain text instead (rendered
// from `scriptureRefLabel` in the template), never a crash from force-unwrapping.
type LoadableScriptureRef = ScriptureRef & {
    bookNumber: number;
    chapter: number;
    verse_start: number;
};

function isLoadableRef(ref: ScriptureRef): ref is LoadableScriptureRef {
    return ref.bookNumber != null && ref.chapter != null && ref.verse_start != null;
}

async function loadSermonScripture(sermon: SermonType) {
    const loadable = (sermon.scripture_refs ?? []).filter(isLoadableRef);
    const versions = [...bibleStore.selectedBibleVersions];
    const token = ++scriptureLoadToken;
    scriptureVerseGroups.value = [];
    scriptureVersionIndexes.value = {};

    if (!loadable.length || !versions.length) return;

    scriptureLoading.value = true;
    try {
        const groups = await Promise.all(
            loadable.map(async (ref, index) => {
                const start = ref.verse_start;
                const end = ref.verse_end ?? start;
                const verseNumbers: number[] = [];
                for (let v = start; v <= end; v++) verseNumbers.push(v);

                const perVerse = await Promise.all(
                    verseNumbers.map((verse) =>
                        window.browserWindow
                            .getVerseText({
                                bible_versions: versions,
                                book_number: ref.bookNumber,
                                chapter: ref.chapter,
                                verse,
                            })
                            .catch((error) => {
                                console.error('getVerseText failed:', error);
                                return [] as Array<{ version: string; text: string }>;
                            })
                    )
                );

                const textsByVersion = new Map<string, string[]>();
                for (const results of perVerse) {
                    for (const item of results) {
                        const cleaned = cleanScriptureHtml(item.text ?? '');
                        if (!hasVisibleText(cleaned)) continue;
                        const arr = textsByVersion.get(item.version) ?? [];
                        arr.push(cleaned);
                        textsByVersion.set(item.version, arr);
                    }
                }

                const versionRows: ScriptureVerseVersion[] = [...textsByVersion.entries()].map(
                    ([version, texts]) => ({
                        version,
                        versionCode: versionShortCode(version),
                        text: texts.join(' '),
                    })
                );

                return {
                    key: `${ref.bookNumber}-${ref.chapter}-${ref.verse_start}-${ref.verse_end ?? ''}-${index}`,
                    refLabel: scriptureRefLabel(ref),
                    versions: versionRows,
                };
            })
        );

        if (token === scriptureLoadToken) {
            scriptureVerseGroups.value = groups.filter((group) => group.versions.length > 0);
        }
    } finally {
        if (token === scriptureLoadToken) scriptureLoading.value = false;
    }
}

function scriptureVersionIndex(group: ScriptureVerseGroup) {
    const index = scriptureVersionIndexes.value[group.key] ?? 0;
    return Math.min(index, Math.max(group.versions.length - 1, 0));
}

function activeScriptureVersion(group: ScriptureVerseGroup) {
    return group.versions[scriptureVersionIndex(group)];
}

function shiftScriptureVersion(group: ScriptureVerseGroup, direction: -1 | 1) {
    if (group.versions.length < 2) return;

    const current = scriptureVersionIndex(group);
    const next = (current + direction + group.versions.length) % group.versions.length;
    scriptureVersionIndexes.value = {
        ...scriptureVersionIndexes.value,
        [group.key]: next,
    };
}

watch(
    () => [...bibleStore.selectedBibleVersions],
    () => {
        if (props.show && hydrated.value) loadSermonScripture(hydrated.value);
    }
);
</script>

<template>
    <NModal
        :show="show"
        preset="card"
        :title="sermon?.title ?? ''"
        class="sermon-detail-modal !max-w-1120px !w-[94vw]"
        :bordered="false"
        @update:show="handleUpdateShow"
    >
        <div v-if="sermon" class="detail-body">
            <img
                v-if="sermon.thumbnail_url"
                :src="sermon.thumbnail_url"
                :alt="sermon.title"
                class="detail-hero"
            />

            <div class="detail-layout">
                <div class="detail-main">
                    <div v-if="hydrated && (hydrated.video_url || hydrated.audio_url)" class="detail-actions">
                        <a v-if="hydrated.video_url" :href="hydrated.video_url" target="_blank" rel="noopener">
                            <NButton size="small" type="info">
                                <template #icon><Icon icon="mdi:play-circle-outline" /></template>
                                Watch Video
                            </NButton>
                        </a>
                        <a v-if="hydrated.audio_url" :href="hydrated.audio_url" target="_blank" rel="noopener">
                            <NButton size="small">
                                <template #icon><Icon icon="mdi:headphones" /></template>
                                Listen
                            </NButton>
                        </a>
                    </div>

                    <!-- Plain string, not $t(): InternationalMessage.ts is a typed key
                         interface, so $t('Not available offline.') would not typecheck. -->
                    <div v-if="hydrating" class="detail-content detail-content-loading">
                        <NSpin size="small" />
                    </div>
                    <div v-else-if="notFound" class="detail-content opacity-60">
                        Sermon details are unavailable.
                    </div>
                    <div v-else-if="!hydrated?.content" class="detail-content opacity-60">
                        Not available offline.
                    </div>
                    <div
                        v-else-if="hydrated.content_format === 'html'"
                        class="detail-content"
                        v-html="hydrated.content"
                    />
                    <div
                        v-else-if="hydrated.content_format === 'markdown'"
                        class="detail-content markdown-body"
                        v-html="renderMarkdown(hydrated.content)"
                    />
                    <div v-else class="detail-content">
                        <!-- Mirrors mobile's SermonBody plain-format fallback: split on
                             blank lines, trim each block, drop empties rather than
                             rendering blank paragraphs. -->
                        <p
                            v-for="(block, i) in hydrated.content.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b.length > 0)"
                            :key="i"
                        >{{ block }}</p>
                    </div>

                    <div v-if="sermon.topics?.length" class="detail-tags">
                        <span v-for="topic in sermon.topics" :key="topic" class="detail-tag">#{{ topic }}</span>
                    </div>
                </div>

                <aside class="detail-sidebar">
                    <div class="detail-header">
                        <div class="detail-meta">
                            <span class="detail-meta-item">
                                <Icon icon="mdi:account-tie" />
                                {{ sermon.speaker_name }}<template v-if="sermon.speaker_title">, {{ sermon.speaker_title }}</template>
                            </span>
                            <span v-if="sermon.preached_at || sermon.published_at" class="detail-meta-item">
                                <Icon icon="mdi:calendar-blank-outline" />
                                {{ formatDate(sermon.preached_at || sermon.published_at) }}
                            </span>
                            <span class="detail-meta-item detail-view-count">
                                <Icon icon="mdi:eye-outline" />
                                {{ viewLabel(sermon.view_count) }}
                            </span>
                        </div>

                        <div class="detail-badges">
                            <NTag v-if="sermon.featured" size="small" :bordered="false" type="warning">
                                Featured
                            </NTag>
                            <NTag v-if="seriesLabel" size="small" :bordered="false">
                                <template #icon><Icon icon="mdi:playlist-play" /></template>
                                {{ seriesLabel }}
                            </NTag>
                        </div>

                        <p v-if="sermon.summary" class="detail-summary">{{ sermon.summary }}</p>

                        <div v-if="scriptureLabelText" class="detail-scripture">
                            <Icon icon="mdi:book-open-variant" class="detail-scripture-icon" />
                            <span class="detail-scripture-label">Scripture</span>
                            <template v-if="scriptureRefsList.length">
                                <span v-for="(ref, i) in scriptureRefsList" :key="i">
                                    {{ scriptureRefLabel(ref) }}<span v-if="i < scriptureRefsList.length - 1"> · </span>
                                </span>
                            </template>
                            <span v-else>{{ sermon.primary_scripture }}</span>
                        </div>

                        <div v-if="scriptureRefsList.length" class="detail-verse-preview">
                            <div v-if="scriptureLoading" class="detail-verse-loading">
                                <NSpin size="small" />
                            </div>

                            <div v-else-if="scriptureVerseGroups.length" class="detail-verse-list">
                                <div
                                    v-for="group in scriptureVerseGroups"
                                    :key="group.key"
                                    class="detail-verse-row"
                                >
                                    <div class="detail-verse-line">
                                        <span class="detail-version-code">{{ activeScriptureVersion(group).versionCode }}</span>
                                        <span class="detail-verse-ref">{{ group.refLabel }}</span>
                                        <div v-if="group.versions.length > 1" class="detail-verse-pager">
                                            <button
                                                type="button"
                                                class="detail-verse-pager-btn"
                                                @click="shiftScriptureVersion(group, -1)"
                                            >
                                                <Icon icon="mdi:chevron-left" />
                                            </button>
                                            <span class="detail-verse-pager-count">
                                                {{ scriptureVersionIndex(group) + 1 }}/{{ group.versions.length }}
                                            </span>
                                            <button
                                                type="button"
                                                class="detail-verse-pager-btn"
                                                @click="shiftScriptureVersion(group, 1)"
                                            >
                                                <Icon icon="mdi:chevron-right" />
                                            </button>
                                        </div>
                                    </div>
                                    <div class="detail-verse-text" v-html="activeScriptureVersion(group).text" />
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    </NModal>
</template>

<style scoped>
/* ── Detail modal ── */
.sermon-detail-modal :deep(.n-card) {
    background: var(--theme-bg-elevated, #30304f);
    border: 1px solid var(--theme-border, rgba(255,255,255,0.12));
    box-shadow: 0 24px 60px rgba(0,0,0,0.36);
    overflow: hidden;
}
.sermon-detail-modal :deep(.n-card-header) {
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--theme-border, rgba(255,255,255,0.08));
}
.sermon-detail-modal :deep(.n-card-header__main) {
    color: var(--theme-text, inherit);
    font-size: 19px;
    font-weight: 800;
    line-height: 1.35;
}
.sermon-detail-modal :deep(.n-card__content) {
    padding: 0;
}
.detail-body {
    display: flex;
    flex-direction: column;
    max-height: min(78vh, 760px);
    color: var(--theme-text, inherit);
    overflow: hidden;
}
.detail-hero {
    width: 100%;
    max-height: 240px;
    object-fit: cover;
    border-bottom: 1px solid var(--theme-border, rgba(255,255,255,0.08));
}
.detail-layout {
    display: flex;
    flex: 1;
    min-height: 0;
}
.detail-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.detail-sidebar {
    width: min(380px, 38%);
    flex-shrink: 0;
    overflow-y: auto;
    border-left: 1px solid var(--theme-border, rgba(255,255,255,0.08));
    background: color-mix(in srgb, var(--theme-bg-soft, #282846) 42%, transparent);
}
.detail-sidebar::-webkit-scrollbar { width: 4px; }
.detail-sidebar::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255,255,255,0.16)); border-radius: 4px; }
.detail-header {
    padding: 18px;
}
.detail-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    font-size: 12px;
    color: var(--theme-text-soft, rgba(255,255,255,0.62));
}
.detail-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
}
.detail-meta-item svg {
    flex-shrink: 0;
    font-size: 14px;
}
.detail-view-count {
    margin-left: auto;
    font-weight: 700;
    color: var(--theme-text, inherit);
}
.detail-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
}
.detail-summary {
    font-size: 14px;
    font-style: italic;
    color: var(--theme-text-soft, rgba(255,255,255,0.68));
    line-height: 1.65;
    margin: 12px 0 0;
}
.detail-scripture {
    font-size: 13px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-bg-elevated, #30304f) 78%, transparent);
    border: 1px solid var(--theme-border, rgba(255,255,255,0.1));
    margin-top: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}
.detail-scripture-icon {
    color: var(--primary-color, #6f84ff);
    opacity: 0.9;
}
.detail-scripture-label {
    font-weight: 800;
}
.detail-verse-preview {
    margin-top: 8px;
}
.detail-verse-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 58px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-bg-elevated, #30304f) 56%, transparent);
    border: 1px solid var(--theme-border, rgba(255,255,255,0.08));
}
.detail-verse-list {
    display: grid;
    gap: 8px;
}
.detail-verse-row {
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-bg-elevated, #30304f) 64%, transparent);
    border: 1px solid var(--theme-border, rgba(255,255,255,0.08));
}
.detail-verse-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
    min-width: 0;
}
.detail-version-code {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 5px;
    color: var(--primary-color, #6f84ff);
    background: color-mix(in srgb, var(--primary-color, #6f84ff) 17%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary-color, #6f84ff) 35%, transparent);
    font-size: 10px;
    font-weight: 800;
    line-height: 1.2;
}
.detail-verse-ref {
    color: var(--theme-text-soft, rgba(255,255,255,0.62));
    font-size: 11px;
    font-weight: 700;
}
.detail-verse-pager {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--theme-text-soft, rgba(255,255,255,0.62));
    font-size: 11px;
    font-weight: 800;
}
.detail-verse-pager-btn {
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 17px;
    line-height: 1;
}
.detail-verse-pager-btn:hover {
    color: var(--theme-text, inherit);
    background: rgba(255,255,255,0.07);
}
.detail-verse-pager-count {
    min-width: 28px;
    text-align: center;
}
.detail-verse-text {
    color: var(--theme-text, inherit);
    font-size: 13px;
    line-height: 1.55;
}
.detail-verse-text :deep(a) {
    display: none;
}
.detail-verse-text :deep(s) {
    color: var(--theme-text-soft, rgba(255,255,255,0.62));
    text-decoration: none;
}
.detail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px 24px 0;
}
.detail-content {
    font-size: 15px;
    line-height: 1.78;
    margin: 16px 24px 0;
    padding: 0 16px 18px 0;
    flex: 1;
    min-height: 220px;
    overflow-y: auto;
    color: var(--theme-text, inherit);
}
.detail-content::-webkit-scrollbar { width: 4px; }
.detail-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255,255,255,0.16)); border-radius: 4px; }
.detail-content :deep(p) { margin: 0 0 0.75em; }
.detail-content :deep(h1),
.detail-content :deep(h2),
.detail-content :deep(h3) { font-weight: 700; margin: 1em 0 0.4em; }
.detail-content-loading {
    display: flex;
    align-items: center;
    justify-content: center;
}
.detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 24px 20px;
}
.detail-tag {
    color: var(--theme-text-soft, rgba(255,255,255,0.58));
    font-size: 12px;
    font-weight: 700;
}

/* Rendered Markdown — mirrors Views/AiAssistant/ChatThread.vue's .markdown-body
   so headings, blockquotes and lists get styled instead of rendering as
   unstyled runs of text. */
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) { font-weight: 700; line-height: 1.3; margin: 14px 0 6px; }
.markdown-body :deep(h2) { font-size: 18px; }
.markdown-body :deep(h3) { font-size: 16px; }
.markdown-body :deep(h4) { font-size: 14.5px; }
.markdown-body :deep(h5), .markdown-body :deep(h6) { font-size: 13px; opacity: 0.9; }
.markdown-body :deep(p) { margin: 8px 0; line-height: 1.6; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 8px 0; padding-left: 22px; }
.markdown-body :deep(li) { margin: 3px 0; line-height: 1.5; }
.markdown-body :deep(strong) { font-weight: 700; }
.markdown-body :deep(em) { font-style: italic; }
.markdown-body :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em; background: rgba(127, 127, 127, 0.15);
    padding: 1px 5px; border-radius: 5px;
}
.markdown-body :deep(blockquote) {
    margin: 8px 0; padding: 4px 12px;
    border-left: 3px solid rgba(127, 127, 127, 0.4); opacity: 0.9;
}
.markdown-body :deep(> :first-child) { margin-top: 0; }
.markdown-body :deep(> :last-child) { margin-bottom: 0; }

@media (max-width: 640px) {
    .sermon-detail-modal :deep(.n-card-header) {
        padding: 16px 18px 12px;
    }
    .detail-header,
    .detail-actions {
        padding-left: 18px;
        padding-right: 18px;
    }
    .detail-content {
        margin-left: 18px;
        margin-right: 18px;
    }
    .detail-view-count {
        margin-left: 0;
    }
}

@media (max-width: 900px) {
    .detail-layout {
        flex-direction: column;
    }
    .detail-sidebar {
        order: -1;
        width: auto;
        max-height: 44vh;
        border-left: 0;
        border-bottom: 1px solid var(--theme-border, rgba(255,255,255,0.08));
    }
}
</style>
