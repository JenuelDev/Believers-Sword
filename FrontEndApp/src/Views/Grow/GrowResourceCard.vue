<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
    title: string;
    description: string;
    cover: string;
    icon: string;
}>();
defineEmits<{ (event: 'click'): void }>();
</script>

<template>
    <button type="button" class="resource-card" @click="$emit('click')">
        <span class="resource-cover" aria-hidden="true">
            <img :src="cover" alt="" width="960" height="640" />
            <span class="resource-icon"><Icon :icon="icon" /></span>
            <Icon icon="mdi:arrow-right" class="resource-arrow" />
        </span>
        <span class="resource-body">
            <span class="resource-title">{{ title }}</span>
            <span class="resource-description">{{ description }}</span>
            <span v-if="$slots.default" class="resource-status"><slot /></span>
            <slot name="progress" />
        </span>
    </button>
</template>

<style scoped>
.resource-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--theme-border);
    border-radius: 20px;
    background: var(--theme-bg-elevated);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease;
}
.resource-card:hover { border-color: var(--theme-text-soft); box-shadow: 0 5px 18px rgb(0 0 0 / 8%); }
.resource-card:focus-visible { outline: 2px solid var(--theme-text); outline-offset: 3px; }
.resource-cover { position: relative; display: block; flex-shrink: 0; width: 100%; height: 160px; background: var(--theme-bg-main); }
.resource-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
.resource-cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 25%, rgb(0 0 0 / 40%)); }
.resource-icon { position: absolute; z-index: 1; left: 14px; bottom: 14px; display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgb(255 255 255 / 20%); border-radius: 11px; background: rgb(0 0 0 / 50%); color: white; }
.resource-icon :deep(svg) { width: 20px; height: 20px; }
.resource-arrow { position: absolute; z-index: 1; right: 16px; bottom: 23px; width: 20px; height: 20px; color: white; }
.resource-body { display: flex; flex: 1; flex-direction: column; align-items: flex-start; min-width: 0; padding: 18px; }
.resource-title { display: block; font-size: 16px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
.resource-description { display: block; margin-top: 6px; color: var(--theme-text-soft); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.resource-status { display: flex; align-items: flex-start; gap: 6px; padding-top: 14px; margin-top: auto; color: var(--theme-text-soft); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.resource-status :deep(svg) { flex-shrink: 0; width: 15px; height: 15px; margin-top: 2px; }
@media (prefers-reduced-motion: reduce) { .resource-card { transition: none; } }
</style>
