<script setup lang="ts">
import { NTooltip } from 'naive-ui';

/** Small "Preview" pill for features whose content is still being refined. */
defineProps<{ message: string }>();
</script>

<template>
    <NTooltip trigger="hover" placement="bottom" :style="{ maxWidth: '280px' }">
        <template #trigger>
            <span class="preview-badge" tabindex="0" :aria-label="`Preview. ${message}`">Preview</span>
        </template>
        {{ message }}
    </NTooltip>
</template>

<style scoped>
.preview-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--primary-color, #6f84ff);
    background: color-mix(in srgb, var(--primary-color, #6f84ff) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary-color, #6f84ff) 45%, transparent);
    cursor: help;
    user-select: none;
    vertical-align: middle;
}
.preview-badge:focus-visible { outline: 2px solid var(--primary-color, #6f84ff); outline-offset: 2px; }
</style>
