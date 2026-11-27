<script setup lang="ts">
import { ref } from 'vue';
import { NButton } from 'naive-ui';
import { Icon } from '@iconify/vue';
import InfographicPdf from './InfographicPdf.vue';
import { bibleFamilyTreeNote, bibleFamilyTreeUrl } from './bibleFamilyTree';

const emit = defineEmits<{ (event: 'back'): void }>();
const pdf = ref<InstanceType<typeof InfographicPdf>>();
</script>

<template>
    <section class="family-tree-page">
        <header class="flex items-center gap-3 flex-wrap">
            <NButton quaternary @click="emit('back')"><Icon icon="mdi:arrow-left" /> Grow</NButton>
            <h1 class="text-xl font-bold flex-1">Bible Family Tree</h1>
            <NButton size="small" @click="pdf?.goToLastPage()"><Icon icon="mdi:format-list-numbered" /> References</NButton>
        </header>
        <p class="flex items-start gap-2 text-sm text-[var(--theme-text-soft)]">
            <Icon icon="mdi:information-outline" class="shrink-0 mt-0.5" />
            <span>{{ bibleFamilyTreeNote }}</span>
        </p>
        <InfographicPdf ref="pdf" :url="bibleFamilyTreeUrl()" />
    </section>
</template>

<style scoped>
.family-tree-page { height: 100%; min-height: 0; padding: 16px; color: var(--theme-text); display: flex; flex-direction: column; gap: 12px; }
.family-tree-page h1, .family-tree-page p { margin: 0; }
</style>
