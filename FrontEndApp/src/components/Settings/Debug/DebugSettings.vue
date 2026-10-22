<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { NButton, NModal, NTag } from 'naive-ui';
import { useMainStore } from '../../../store/main';
import { useOnboardingStore } from '../../../store/onboardingStore';

const enabled = import.meta.env.DEV && Boolean(window.isElectron);
const mainStore = useMainStore();
const onboarding = useOnboardingStore();
const showSplash = ref(false);
const splashRun = ref(0);
const splashUrl = ref('');

function previewLoading() {
    if (!enabled) return;
    const colors = getComputedStyle(document.body);
    const url = new URL(`${import.meta.env.BASE_URL || '/'}splash.html`, window.location.href);
    url.searchParams.set('version', String(mainStore.version));
    url.searchParams.set('bg', colors.getPropertyValue('--theme-bg-main').trim() || '#ffffff');
    url.searchParams.set('text', colors.getPropertyValue('--theme-text').trim() || '#1f2233');
    url.searchParams.set('accent', colors.getPropertyValue('--primary-color').trim() || '#4f46e5');
    splashUrl.value = url.href;
    splashRun.value++;
    showSplash.value = true;
}

async function previewOnboarding() {
    if (!enabled) return;
    mainStore.showSettings = false;
    // Drop the Settings focus trap before opening the global tour dialog.
    await nextTick();
    onboarding.replay();
}
</script>

<template>
    <div v-if="enabled" class="debug-settings">
        <div class="debug-heading">
            <div><h2>Startup previews</h2><p>Inspect the opening screens without restarting the app.</p></div>
            <NTag size="small" :bordered="false" type="warning">Development only</NTag>
        </div>
        <section class="debug-preview-card">
            <h3>Loading splash</h3>
            <p>Preview the opening logo, tagline and loading animation in your current theme.</p>
            <NButton @click="previewLoading">Preview loading</NButton>
        </section>
        <section class="debug-preview-card">
            <h3>Onboarding</h3>
            <p>Replay the feature walkthrough from the first step. Your saved tour completion stays as it is.</p>
            <NButton @click="previewOnboarding">Open onboarding</NButton>
        </section>

        <NModal v-model:show="showSplash" preset="card" title="Loading splash preview"
            class="debug-splash-modal" :mask-closable="false" :bordered="false"
            :style="{ width: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }">
            <iframe v-if="showSplash" :key="splashRun" :src="splashUrl" sandbox="allow-scripts"
                title="Believers Sword loading splash" class="debug-splash-frame" />
            <p class="debug-splash-note">The preview stays open for inspection. Replay restarts the animation.</p>
            <template #footer>
                <div class="debug-splash-actions">
                    <NButton @click="previewLoading">Replay</NButton>
                    <NButton type="primary" @click="showSplash = false">Close</NButton>
                </div>
            </template>
        </NModal>
    </div>
</template>

<style scoped>
.debug-settings { display: grid; gap: 16px; padding: 16px 0; }
.debug-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.debug-heading h2, .debug-preview-card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.debug-heading p, .debug-preview-card p { margin: 0; color: var(--theme-text-soft); font-size: 12px; line-height: 1.6; }
.debug-preview-card { border: 1px solid var(--theme-border); background: var(--theme-bg-soft); border-radius: 10px; padding: 16px; }
.debug-preview-card p { margin-bottom: 14px; }
.debug-splash-frame { display: block; width: 100%; max-width: 480px; aspect-ratio: 8 / 5; margin-inline: auto; border: 0; border-radius: 8px; }
.debug-splash-note { margin: 16px 0 0; color: var(--theme-text-soft); font-size: 12px; line-height: 1.6; }
.debug-splash-actions { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 480px) { .debug-heading { flex-direction: column; gap: 8px; } }
</style>
