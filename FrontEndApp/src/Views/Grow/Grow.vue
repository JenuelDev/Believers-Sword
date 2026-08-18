<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import Sermons from '../Sermons/Sermons.vue';

type Screen = 'hub' | 'sermons';

const activeScreen = ref<Screen>('hub');
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <!-- Hub -->
        <div
            v-show="activeScreen === 'hub'"
            class="flex-1 min-h-0 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-3"
        >
            <h1 class="text-xl font-bold text-[var(--theme-text)] pt-1">Grow</h1>
            <p class="text-sm text-[var(--theme-text-soft)]">
                Resources to help you grow in the Word.
            </p>
            <div
                class="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-elevated)] p-4 cursor-pointer hover:shadow-md transition-shadow"
                @click="activeScreen = 'sermons'"
            >
                <div class="flex items-start gap-4">
                    <div
                        class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style="background: #8b5cf622"
                    >
                        🎙️
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm text-[var(--theme-text)]">Sermons</p>
                        <p class="text-xs text-[var(--theme-text-soft)] mt-0.5">
                            Browse and favorite sermons.
                        </p>
                    </div>
                    <span class="text-[var(--theme-text-soft)] text-lg">&rsaquo;</span>
                </div>
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
    </div>
</template>
