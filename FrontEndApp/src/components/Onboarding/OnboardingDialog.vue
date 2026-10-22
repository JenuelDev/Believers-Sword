<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { NButton, NModal, useThemeVars } from 'naive-ui';
import { useOnboardingStore } from '../../store/onboardingStore';
import { onboardingSteps } from './onboardingSteps';
import OnboardingIllustration from './OnboardingIllustration.vue';

const props = defineProps<{ eligible: boolean }>();
const tour = useOnboardingStore();
const theme = useThemeVars();
const desktop = Boolean(window.isElectron);
const steps = onboardingSteps(desktop);
const index = computed(() => Math.min(Math.max(tour.step, 0), steps.length - 1));
const current = computed(() => steps[index.value]);
const last = computed(() => index.value === steps.length - 1);
const visible = computed(() => props.eligible && (tour.needed || tour.replaying));
const content = ref<HTMLElement | null>(null);
const title = ref<HTMLElement | null>(null);
const colors = computed(() => ({
    '--tour-accent': theme.value.primaryColor,
    '--tour-border': theme.value.borderColor,
    '--tour-soft': theme.value.bodyColor,
    '--tour-card': theme.value.cardColor,
    '--tour-tint': `color-mix(in srgb, ${theme.value.primaryColor} 12%, transparent)`,
    '--tour-highlight': `color-mix(in srgb, ${theme.value.primaryColor} 18%, transparent)`,
    '--tour-text': theme.value.textColor1,
    '--tour-muted': theme.value.textColor2,
}));

watch(() => props.eligible, (eligible) => { if (eligible) tour.initialize(); }, { immediate: true });

async function move(value: number) {
    tour.setStep(value, steps.length);
    await nextTick();
    content.value?.scrollTo({ top: 0 });
    title.value?.focus({ preventScroll: true });
}

function advance() {
    if (last.value) tour.finish();
    else void move(index.value + 1);
}
</script>

<template>
    <NModal :show="visible" preset="card" :closable="false" :mask-closable="false"
        :close-on-esc="false" :auto-focus="true" :trap-focus="true" :bordered="false"
        :content-style="{ padding: '0', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }"
        class="onboarding-dialog" :style="colors" role="dialog" aria-modal="true" aria-label="Believers Sword app tour">
        <div class="tour-shell">
            <header class="tour-header">
                <div class="tour-brand">
                    <span class="tour-brand-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" /></svg>
                    </span>
                    <div><div class="tour-eyebrow">BELIEVERS SWORD</div><strong>Peace be with you</strong></div>
                </div>
                <NButton v-if="!last" quaternary size="small" @click="tour.finish">{{ tour.replaying ? 'Close tour' : 'Skip tour' }}</NButton>
            </header>
            <div class="tour-body">
                <nav class="tour-steps" aria-label="Tour steps">
                    <div class="tour-nav-label">GETTING STARTED</div>
                    <button v-for="(step, position) in steps" :key="step.id" type="button"
                        :class="{ active: index === position }" :aria-current="index === position ? 'step' : undefined"
                        :aria-label="`Step ${position + 1}: ${step.label}`" @click="move(position)">
                        <span class="step-number" aria-hidden="true">{{ position < index ? '✓' : position + 1 }}</span><span class="step-label">{{ step.label }}</span>
                    </button>
                </nav>
                <main ref="content" class="tour-content">
                    <div class="tour-stage">
                        <div class="tour-visual"><OnboardingIllustration :step="current.id" :desktop="desktop" /></div>
                        <section class="tour-copy" aria-labelledby="tour-title">
                            <div class="tour-counter">{{ desktop ? 'DESKTOP' : 'WEB' }} · STEP {{ index + 1 }} OF {{ steps.length }}</div>
                            <h1 id="tour-title" ref="title" tabindex="-1">{{ current.title }}</h1>
                            <p class="tour-description">{{ current.description }}</p>
                            <ul><li v-for="feature in current.features" :key="feature"><span aria-hidden="true">✓</span>{{ feature }}</li></ul>
                            <p class="tour-tip">{{ current.tip }}</p>
                        </section>
                    </div>
                </main>
            </div>
            <footer class="tour-footer">
                <NButton class="tour-back" :disabled="index === 0" @click="move(index - 1)">Back</NButton>
                <div class="tour-progress" role="status" aria-live="polite">
                    <span>{{ index + 1 }} of {{ steps.length }}</span>
                    <div class="tour-progress-track" aria-hidden="true"><span :style="{ width: `${(index + 1) / steps.length * 100}%` }" /></div>
                </div>
                <NButton class="tour-next" type="primary" @click="advance">{{ last ? (tour.replaying ? 'Done' : 'Start reading') : 'Next' }}<span aria-hidden="true" class="tour-next-arrow">›</span></NButton>
            </footer>
        </div>
    </NModal>
</template>

<style src="./onboarding-dialog.css" />
