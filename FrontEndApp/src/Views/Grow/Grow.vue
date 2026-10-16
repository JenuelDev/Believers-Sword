<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import Sermons from '../Sermons/Sermons.vue';
import Infographics from './Infographics.vue';
import { useInfographicsDownload } from './useInfographicsDownload';

type Screen = 'hub' | 'sermons' | 'infographics';

const activeScreen = ref<Screen>('hub');
const downloadState = useInfographicsDownload();
const { resources, busy, percent, phase, error } = downloadState;
const infographicCount = computed(() => resources.value.length);
const downloadPercent = computed(() => percent.value === null ? null : Math.round(Math.min(1, Math.max(0, percent.value)) * 100));
onMounted(() => {
    if (window.isElectron) void downloadState.initialize();
});
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <div v-show="activeScreen === 'hub'" class="grow-hub">
            <div class="grow-content">
                <header class="grow-heading">
                    <h1>Grow</h1>
                    <p>Resources to help you grow in the Word.</p>
                </header>
                <div class="resource-list" aria-label="Growth resources">
                    <button type="button" class="resource-row" @click="activeScreen = 'sermons'">
                        <Icon icon="mdi:microphone-outline" class="resource-icon" />
                        <span class="resource-copy">
                            <span class="resource-title">Sermons</span>
                            <span class="resource-description">Browse and favorite sermons.</span>
                        </span>
                        <span class="resource-status">Browse sermons</span>
                        <Icon icon="mdi:arrow-right" class="resource-arrow" />
                    </button>
                    <button type="button" class="resource-row" @click="activeScreen = 'infographics'">
                        <Icon icon="mdi:book-open-page-variant-outline" class="resource-icon" />
                        <span class="resource-copy">
                            <span class="resource-title">Wesley Huff Info Graphics</span>
                            <span class="resource-description">www.wesleyhuff.com</span>
                        </span>
                        <span class="resource-status" role="status">
                            <Icon v-if="busy" icon="mdi:download" />
                            <Icon v-else-if="infographicCount && !error" icon="mdi:check" />
                            <Icon v-else-if="!error" icon="mdi:download" />
                            <span>{{ busy ? (downloadPercent !== null ? `${downloadPercent}% downloaded` : phase) : error ? 'Download interrupted' : infographicCount ? `${infographicCount} available offline` : 'Download collection' }}</span>
                        </span>
                        <Icon icon="mdi:arrow-right" class="resource-arrow" />
                        <progress v-if="busy" class="resource-progress" :value="percent ?? undefined" max="1" aria-label="Infographics download progress" />
                    </button>
                </div>
            </div>
        </div>
        <!-- Sermons: kept mounted (v-show) so its scroll state and internal
             tab/favorites state behave exactly as when it lived directly in
             App.vue -->
        <div v-show="activeScreen === 'sermons'" class="flex-1 min-h-0 flex flex-col">
            <div class="px-4 pt-2 shrink-0">
                <button
                    class="flex items-center gap-1 text-sm text-[var(--theme-text-soft)] hover:text-[var(--theme-text)] cursor-pointer bg-transparent border-none"
                    @click="activeScreen = 'hub'"
                >
                    <Icon icon="mdi:arrow-left" /> Grow
                </button>
            </div>
            <div class="flex-1 min-h-0">
                <Sermons />
            </div>
        </div>
        <Infographics v-if="activeScreen === 'infographics'" @back="activeScreen = 'hub'" />
    </div>
</template>

<style scoped>
.grow-hub { flex: 1; min-height: 0; overflow-y: auto; color: var(--theme-text); }
.grow-content { width: 100%; max-width: 800px; margin: 0 auto; padding: 36px 24px; box-sizing: border-box; }
.grow-heading { margin-bottom: 28px; }
.grow-heading h1 { margin: 0 0 8px; padding: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.5px; }
.grow-heading p { margin: 0; font-size: 13px; line-height: 21px; color: var(--theme-text-soft); }
.resource-list { border-top: 1px solid var(--theme-border); }
.resource-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto 18px; align-items: center; gap: 16px; width: 100%; min-height: 96px; padding: 20px 12px; border: 0; border-bottom: 1px solid var(--theme-border); border-radius: 0; background: transparent; color: var(--theme-text); font: inherit; text-align: left; cursor: pointer; transition: background-color 120ms ease; }
.resource-row:hover { background: var(--theme-bg-elevated); }
.resource-row:focus-visible { outline: 2px solid var(--theme-text); outline-offset: -2px; }
.resource-icon { width: 22px; height: 22px; color: var(--theme-text-soft); }
.resource-copy { min-width: 0; }
.resource-title { display: block; margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; }
.resource-description { display: block; margin-top: 4px; color: var(--theme-text-soft); font-size: 12px; line-height: 20px; overflow-wrap: anywhere; }
.resource-status { display: flex; align-items: center; justify-content: flex-end; gap: 6px; max-width: 210px; color: var(--theme-text-soft); font-size: 12px; line-height: 20px; }
.resource-status :deep(svg) { flex-shrink: 0; width: 15px; height: 15px; }
.resource-arrow { width: 17px; height: 17px; color: var(--theme-text-soft); }
.resource-progress { grid-column: 2 / -1; width: 100%; height: 3px; border: 0; accent-color: var(--theme-text); }
@media (max-width: 600px) {
    .grow-content { padding: 24px 16px; }
    .resource-row { grid-template-columns: 22px minmax(0, 1fr) 18px; gap: 8px 12px; padding: 18px 8px; }
    .resource-icon { grid-column: 1; grid-row: 1; }
    .resource-copy { grid-column: 2; grid-row: 1; }
    .resource-status { grid-column: 2; grid-row: 2; justify-content: flex-start; max-width: none; }
    .resource-arrow { grid-column: 3; grid-row: 1 / 3; }
}
</style>