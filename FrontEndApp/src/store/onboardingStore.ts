import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_KEY = 'believers-sword.onboarding';

export const useOnboardingStore = defineStore('onboarding', () => {
    const completedVersion = ref(0);
    const step = ref(0);
    const replaying = ref(false);
    let initialized = false;
    const needed = computed(() => completedVersion.value < ONBOARDING_VERSION);

    function initialize() {
        if (initialized) return;
        initialized = true;
        try {
            const saved = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) || 'null');
            if (Number.isInteger(saved?.completedVersion)) completedVersion.value = saved.completedVersion;
            if (saved?.version === ONBOARDING_VERSION && Number.isInteger(saved?.step)) {
                step.value = Math.max(0, saved.step);
            }
        } catch {
            // Missing, malformed or unavailable storage starts a fresh local tour.
        }
    }

    function persist() {
        try {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
                version: ONBOARDING_VERSION,
                completedVersion: completedVersion.value,
                step: step.value,
            }));
        } catch (error) {
            // Keep the app usable when browser storage is blocked or full.
            console.warn('Could not save local onboarding progress', error);
        }
    }

    function setStep(value: number, count: number) {
        step.value = Math.max(0, Math.min(value, count - 1));
        if (!replaying.value) persist();
    }

    function finish() {
        if (replaying.value) {
            replaying.value = false;
            return;
        }
        completedVersion.value = ONBOARDING_VERSION;
        step.value = 0;
        persist();
    }

    function replay() {
        initialize();
        step.value = 0;
        replaying.value = true;
    }

    return { step, needed, replaying, initialize, setStep, finish, replay };
});
