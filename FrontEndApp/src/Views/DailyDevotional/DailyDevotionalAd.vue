<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import { NTooltip } from 'naive-ui';
import { Icon } from '@iconify/vue';

const isWeb = !window.isElectron;
const testMode = import.meta.env.DEV;
const adElement = shallowRef<HTMLElement | null>(null);
const unavailable = ref(false);
const showAdInfo = ref(false);
const adInfo = 'Ads in the free version help cover a small part of our server costs.';
let observer: ResizeObserver | undefined;
let script: HTMLScriptElement | null = null;
let requested = false;

function handleScriptError() {
    unavailable.value = true;
    script?.remove();
}

function requestAd() {
    const element = adElement.value;
    if (window.isElectron || requested || !element?.isConnected || element.clientWidth === 0) return;
    requested = true;
    observer?.disconnect();

    script = document.querySelector<HTMLScriptElement>('script[data-daily-devotion-adsense]');
    if (!script) {
        script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2268807726840190';
        script.crossOrigin = 'anonymous';
        script.dataset.dailyDevotionAdsense = 'true';
        script.addEventListener('error', handleScriptError);
        document.head.appendChild(script);
    } else {
        script.addEventListener('error', handleScriptError);
    }

    try {
        const adWindow = window as Window & { adsbygoogle?: { push: (ad: object) => unknown } };
        (adWindow.adsbygoogle = adWindow.adsbygoogle || [] as object[]).push({});
    } catch {
        unavailable.value = true;
    }
}

onMounted(() => {
    // A local preview is deterministic and makes no advertising requests.
    if (window.isElectron || testMode) return;
    observer = new ResizeObserver(requestAd);
    if (adElement.value) observer.observe(adElement.value);
    requestAd();
});

onBeforeUnmount(() => {
    observer?.disconnect();
    script?.removeEventListener('error', handleScriptError);
});
</script>

<template>
    <div v-if="!unavailable && isWeb" class="devotion-ad">
        <div class="devotion-ad-label">
            <span>Ad</span>
            <NTooltip v-model:show="showAdInfo" trigger="hover" placement="top-end" :style="{ maxWidth: '260px' }">
                <template #trigger>
                    <button
                        type="button"
                        class="devotion-ad-info"
                        :aria-label="adInfo"
                        @focus="showAdInfo = true"
                        @blur="showAdInfo = false"
                        @click="showAdInfo = true"
                        @keydown.esc="showAdInfo = false"
                    >
                        <Icon icon="mdi:information-outline" aria-hidden="true" />
                    </button>
                </template>
                {{ adInfo }}
            </NTooltip>
        </div>
        <div v-if="testMode" class="devotion-ad-preview" aria-label="Test advertisement">
            <strong>Test ad</strong>
            <span>Daily Devotion banner preview</span>
        </div>
        <!-- Believers Sword Web Daily Devotion -->
        <ins
            v-else
            ref="adElement"
            class="adsbygoogle"
            style="display: block; width: 100%; height: 90px"
            data-ad-client="ca-pub-2268807726840190"
            data-ad-slot="8931055413"
        ></ins>
    </div>
</template>

<style scoped>
.devotion-ad {
    width: 100%;
    flex-shrink: 0;
    margin: 0 0 16px;
}

.devotion-ad-label {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    color: var(--theme-text-soft, #777);
    font-size: 11px;
    line-height: 16px;
}

.devotion-ad-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font-size: 14px;
    cursor: help;
}

.devotion-ad-info:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.devotion-ad-preview {
    box-sizing: border-box;
    height: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, currentColor 4%, transparent);
    font-size: 12px;
    opacity: 0.65;
}
</style>
