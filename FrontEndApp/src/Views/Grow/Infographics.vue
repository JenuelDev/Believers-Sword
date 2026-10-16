<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useInfographicsDownload } from './useInfographicsDownload';
import { NButton, NInput, NModal, NProgress, NSelect } from 'naive-ui';
import { Icon } from '@iconify/vue';
import InfographicPdf from './InfographicPdf.vue';
import InfographicImage from './InfographicImage.vue';
import { rotateView } from './viewRotation';

type Resource = Awaited<ReturnType<typeof window.browserWindow.listInfographics>>[number];
const emit = defineEmits<{ (event: 'back'): void }>();
const source = 'https://www.wesleyhuff.com/infographics';
const isDesktop = Boolean(window.isElectron);
const zipUrl = 'https://github.com/JenuelDev/Believers-Sword/raw/refs/heads/main/contents/grow/wesleyhuff.com%20infographics/wesleyhuff.com.infographics%202026-10-16.zip';
const downloadState = useInfographicsDownload();
const { resources, loading, busy, error, phase, percent } = downloadState;

const consent = ref(false);

const search = ref('');
const category = ref('All');
const selected = ref<Resource | null>(null);
const zoom = ref(1);
const rotation = ref(0);

const categories = computed(() => ['All', ...new Set(resources.value.map(item => item.category))]
    .map(value => ({ label: value, value })));
const visible = computed(() => resources.value.filter(item =>
    (category.value === 'All' || item.category === category.value) &&
    `${item.title} ${item.fileName}`.toLowerCase().includes(search.value.toLowerCase())));

onMounted(async () => {
    if (!isDesktop) return;
    await downloadState.initialize();
    if (!resources.value.length && !busy.value && !error.value) consent.value = true;
});

function download() {
    consent.value = false;
    void downloadState.start();
}
function open(item: Resource) {
    selected.value = item;
    zoom.value = 1;
    rotation.value = 0;
}
</script>

<template>
    <section class="infographics-page">
        <header class="flex items-center gap-3 flex-wrap">
            <NButton quaternary @click="emit('back')"><Icon icon="mdi:arrow-left" /> Grow</NButton>
            <h1 class="text-xl font-bold flex-1">Wesley Huff Info Graphics</h1>
            <a :href="source" target="_blank" rel="noopener noreferrer" class="infographics-link text-sm">Visit Wesley Huff <Icon icon="mdi:open-in-new" class="inline" /></a>
        </header>
        <p class="text-sm text-[var(--theme-text-soft)]">By Wesley Huff | www.wesleyhuff.com</p>
        <p class="text-sm text-[var(--theme-text-soft)]">Free educational resources. Keep watermarks intact and do not alter the images.</p>

        <template v-if="!isDesktop">
            <p>Offline viewing is available in the desktop and Android apps.</p>
            <a :href="zipUrl" class="infographics-link">Download the ZIP collection (82 MB)</a>
        </template>
        <template v-else>
            <p v-if="loading" role="status">Loading saved collection...</p>
            <div v-if="busy" role="status" class="space-y-2">
                <NProgress type="line" :percentage="Math.round(Math.min(1, Math.max(0, percent ?? 0)) * 100)" :processing="true" :show-indicator="false" />
                <div class="flex items-start gap-3 text-sm">
                    <p class="flex-1">{{ phase }}</p>
                    <p v-if="percent !== null" class="font-semibold" aria-live="polite">{{ Math.round(Math.min(1, Math.max(0, percent)) * 100) }}%</p>
                </div>
            </div>
            <p v-if="error" role="alert" class="text-red-500">{{ error }}</p>
            <div v-if="!busy && !loading" class="flex items-center gap-3">
                <p class="text-sm flex-1">{{ resources.length }} resources available offline</p>
                <NButton :type="resources.length ? 'default' : 'primary'" @click="consent = true"><Icon icon="mdi:download" /> {{ resources.length ? 'Download again' : 'Download collection (82 MB)' }}</NButton>
            </div>
            <div v-if="resources.length" class="flex gap-3 flex-wrap">
                <NInput v-model:value="search" placeholder="Search infographics" clearable class="flex-1 min-w-48" />
                <NSelect
                    v-model:value="category"
                    :options="categories"
                    :virtual-scroll="false"
                    :scrollbar-props="{ containerStyle: { scrollBehavior: 'auto', overscrollBehavior: 'contain' } }"
                    style="width: 230px"
                    aria-label="Category"
                />
            </div>
            <div class="infographics-grid">
                <button v-for="item in visible" :key="item.fileName" class="infographic-tile" @click="open(item)">
                    <div v-if="item.isPdf" class="resource-preview flex items-center justify-center"><Icon icon="mdi:file-pdf-box" class="text-5xl text-[var(--theme-text-soft)]" /></div>
                    <img v-else :src="item.url" :alt="item.title" loading="lazy" class="resource-preview" />
                    <div class="p-3 text-left">
                        <p class="font-semibold text-sm break-words">{{ item.title }}</p>
                        <p class="text-xs text-[var(--theme-text-soft)] mt-1">{{ item.category }}{{ item.isPdf ? ' | PDF' : '' }}</p>
                    </div>
                </button>
            </div>
            <p v-if="resources.length && !visible.length" class="text-center text-sm">No resources match your search.</p>
        </template>

        <NModal v-model:show="consent" preset="card" title="Wesley Huff infographics" style="width: min(540px, 92vw)" :mask-closable="false">
            <div class="space-y-4">
                <p>Wesley Huff is a Christian apologist, public speaker, and teacher. His infographics explore the Bible, manuscripts, archaeology, and more.</p>
                <p>He provides these resources free for education and training and invites people to download them. He asks that watermarks remain intact and the images are not altered.</p>
                <p>Download the collection to view it offline? This ZIP is about 82 MB and includes images and PDFs organized by topic. Downloads stay on this device.</p>
                <a :href="source" target="_blank" rel="noopener noreferrer" class="infographics-link">Visit www.wesleyhuff.com</a>
                <div class="flex justify-end gap-2">
                    <NButton @click="consent = false">Not now</NButton>
                    <NButton type="primary" @click="download"><Icon icon="mdi:download" /> Download</NButton>
                </div>
            </div>
        </NModal>

        <NModal :show="selected !== null" @update:show="value => { if (!value) selected = null; }">
            <section v-if="selected" class="infographic-viewer" role="dialog" aria-modal="true" :aria-label="selected.title">
                <header class="infographic-viewer-header">
                    <h2 class="infographic-viewer-title">{{ selected.title }}</h2>
                    <template v-if="!selected.isPdf">
                        <NButton size="tiny" aria-label="Rotate left 90 degrees" title="Rotate left 90°" @click="rotation = rotateView(rotation, -90)"><Icon icon="mdi:rotate-left" /></NButton>
                        <NButton size="tiny" aria-label="Rotate right 90 degrees" title="Rotate right 90°" @click="rotation = rotateView(rotation, 90)"><Icon icon="mdi:rotate-right" /></NButton>
                        <NButton size="tiny" :disabled="zoom <= 0.25" aria-label="Zoom out" @click="zoom = Math.max(0.25, zoom - 0.25)">−</NButton>
                        <NButton size="tiny" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</NButton>
                        <NButton size="tiny" :disabled="zoom >= 4" aria-label="Zoom in" @click="zoom = Math.min(4, zoom + 0.25)">+</NButton>
                    </template>
                    <NButton size="tiny" quaternary aria-label="Close viewer" @click="selected = null"><Icon icon="mdi:close" /></NButton>
                </header>
                <InfographicPdf v-if="selected.isPdf" :key="selected.fileName" :url="selected.url" />
                <InfographicImage v-else :key="selected.fileName" v-model:zoom="zoom" :url="selected.url" :title="selected.title" :rotation="rotation" />
                <footer class="flex items-center justify-between gap-3 flex-wrap p-2 text-xs">
                    <span class="text-[var(--theme-text-soft)]">Ctrl + scroll to zoom. Hold Space and drag to move.</span>
                    <a :href="source" target="_blank" rel="noopener noreferrer" class="infographics-link">Source: www.wesleyhuff.com</a>
                </footer>
            </section>
        </NModal>
    </section>
</template>

<style scoped>
.infographics-link, .infographics-link:visited { color: var(--theme-text); text-decoration: underline; text-underline-offset: 3px; }
.infographics-link:hover { text-decoration-thickness: 2px; }
.infographics-link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 2px; }
.infographics-page { height: 100%; min-height: 0; overflow-y: auto; padding: 16px; color: var(--theme-text); display: flex; flex-direction: column; gap: 12px; }
/* normalize.css keeps default h1/p margins; the flex gap already spaces this page. */
.infographics-page h1, .infographics-page p { margin: 0; }
.infographics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.infographic-tile { padding: 0; cursor: pointer; border: 1px solid var(--theme-border); border-radius: 12px; overflow: hidden; background: var(--theme-bg-elevated); color: var(--theme-text); }
.infographic-tile:hover { border-color: #14b8a6; }
.resource-preview { height: 155px; width: 100%; object-fit: contain; background: #ffffff; }
.infographic-viewer { width: min(1300px, 96vw); height: 92vh; background: var(--theme-bg-elevated); color: var(--theme-text); border: 1px solid var(--theme-border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
.infographic-viewer-header { display: flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 32px; box-sizing: border-box; padding: 4px 8px; border-bottom: 1px solid var(--theme-border); }
.infographic-viewer-title { flex: 1; min-width: 0; margin: 0; padding: 0; font-size: 14px; line-height: 20px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
