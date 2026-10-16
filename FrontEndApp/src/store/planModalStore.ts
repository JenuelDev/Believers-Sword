import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Visibility for the global "Choose your plan" dialog (PlanModal.vue, mounted
 * once in App.vue). Any screen can open it — the account page's "View plans"
 * button calls show().
 */
export const usePlanModalStore = defineStore('planModal', () => {
    const open = ref(false);
    function show() {
        open.value = true;
    }
    function hide() {
        open.value = false;
    }
    return { open, show, hide };
});
