<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import Sermons from '../Sermons/Sermons.vue';
import Infographics from './Infographics.vue';
import { useInfographicsDownload } from './useInfographicsDownload';
import BibleFamilyTree from './BibleFamilyTree.vue';
import BibleQuestions from './BibleQuestions/BibleQuestions.vue';
import { bibleFamilyTreeNote } from './bibleFamilyTree';
import GrowResourceCard from './GrowResourceCard.vue';
import sermonsCover from '../../assets/grow/covers/sermons.jpg';
import infographicsCover from '../../assets/grow/covers/infographics.jpg';
import questionsCover from '../../assets/grow/covers/questions.jpg';
import familyTreeCover from '../../assets/grow/covers/family-tree.jpg';

type Screen = 'hub' | 'sermons' | 'infographics' | 'questions' | 'familyTree';

const activeScreen = ref<Screen>('hub');
// Desktop reads the bundled questions.db; the web reads the backend API.
const isDesktop = Boolean(window.isElectron);
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
                    <div>
                        <h1>
                            <Icon icon="mdi:sprout-outline" class="grow-title-icon" aria-hidden="true" />
                            Grow
                        </h1>
                        <p>Resources to help you grow in the Word.</p>
                    </div>
                </header>
                <section class="resource-grid" aria-label="Growth resources">
                    <GrowResourceCard
                        title="Sermons"
                        description="Explore Bible teaching to deepen your understanding and strengthen your faith."
                        :cover="sermonsCover"
                        icon="mdi:church-outline"
                        @click="activeScreen = 'sermons'"
                    >
                        <span>Browse sermons</span>
                    </GrowResourceCard>
                    <GrowResourceCard
                        title="Wesley Huff's Infographics"
                        description="www.wesleyhuff.com"
                        :cover="infographicsCover"
                        icon="mdi:book-open-page-variant-outline"
                        @click="activeScreen = 'infographics'"
                    >
                        <template #default>
                            <Icon v-if="busy" icon="mdi:download" />
                            <Icon v-else-if="infographicCount && !error" icon="mdi:check" />
                            <Icon v-else-if="!error" icon="mdi:download" />
                            <span role="status">{{ busy ? (downloadPercent !== null ? `${downloadPercent}% downloaded` : phase) : error ? 'Download interrupted' : infographicCount ? `${infographicCount} available offline` : 'Download collection' }}</span>
                        </template>
                        <template #progress>
                            <progress v-if="busy" class="resource-progress" :value="percent ?? undefined" max="1" aria-label="Infographics download progress" />
                        </template>
                    </GrowResourceCard>
                    <GrowResourceCard
                        title="Bible Questions"
                        description="Explore questions about God, faith, and the Bible"
                        :cover="questionsCover"
                        icon="mdi:comment-question-outline"
                        @click="activeScreen = 'questions'"
                    >
                        <Icon :icon="isDesktop ? 'mdi:check' : 'mdi:comment-question-outline'" />
                        <span>{{ isDesktop ? 'Available offline' : 'Browse questions' }}</span>
                    </GrowResourceCard>
                    <GrowResourceCard
                        title="Bible Family Tree"
                        description="From Adam to Jesus Christ"
                        :cover="familyTreeCover"
                        icon="mdi:family-tree"
                        @click="activeScreen = 'familyTree'"
                    >
                        <Icon icon="mdi:check" />
                        <span>Available offline</span>
                    </GrowResourceCard>
                </section>
                <p class="grow-research-note">
                    <Icon icon="mdi:information-outline" aria-hidden="true" />
                    <span>Bible Family Tree: {{ bibleFamilyTreeNote }}</span>
                </p>
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
        <BibleQuestions v-if="activeScreen === 'questions'" @back="activeScreen = 'hub'" />
        <BibleFamilyTree v-if="activeScreen === 'familyTree'" @back="activeScreen = 'hub'" />
    </div>
</template>

<style scoped>
.grow-hub { flex: 1; min-height: 0; overflow-y: auto; color: var(--theme-text); }
.grow-content { width: 100%; max-width: 960px; margin: 0 auto; padding: 36px 24px; box-sizing: border-box; }
.grow-heading { margin-bottom: 28px; }
.grow-heading h1 { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; padding: 0; font-size: 30px; line-height: 38px; font-weight: 700; letter-spacing: -0.8px; }
.grow-heading p { margin: 0; font-size: 13px; line-height: 21px; color: var(--theme-text-soft); }
.grow-heading .grow-title-icon { flex: 0 0 26px; width: 26px; height: 26px; }
.resource-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: 18px; }
.resource-progress { display: block; width: 100%; height: 4px; margin-top: 10px; border: 0; accent-color: var(--theme-text); }
.grow-research-note { display: flex; align-items: flex-start; gap: 8px; margin: 18px 4px 0; padding: 0; color: var(--theme-text-soft); font-size: 12px; line-height: 1.6; }
.grow-research-note :deep(svg) { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; }
@media (max-width: 600px) {
    .grow-content { padding: 24px 16px 36px; }
}
</style>
