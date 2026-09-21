import { computed, ref } from 'vue';

/** Shared desktop/web completion state, driven by persisted calendar days. */
export function useDevotionCompletion(
    completedToday: () => boolean,
    recordToday: () => Promise<boolean>,
) {
    const readingAgain = ref(false);
    const saving = ref(false);
    const saveError = ref('');
    const finished = computed(() => completedToday() && !readingAgain.value);

    async function finishDevotion() {
        if (saving.value) return;
        saving.value = true;
        saveError.value = '';
        try {
            if (!await recordToday()) throw new Error('Completion was not saved');
            readingAgain.value = false;
        } catch {
            saveError.value = "Could not save today's devotion. Please try Finish again.";
        } finally {
            saving.value = false;
        }
    }

    function readAgain() {
        readingAgain.value = true;
        saveError.value = '';
    }

    return { finished, saving, saveError, finishDevotion, readAgain };
}
