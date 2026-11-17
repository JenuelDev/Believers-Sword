<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { NButton } from 'naive-ui';
import { useGamesStore } from '../../store/useGamesStore';
import { useNavBadgesStore } from '../../store/navBadgesStore';
import LivesBar from './components/LivesBar.vue';
import GameCard from './components/GameCard.vue';
import QAGroupsList from './QuestionAndAnswer/QAGroupsList.vue';
import QAGameplay from './QuestionAndAnswer/QAGameplay.vue';
import TFGroupsList from './TrueOrFalse/TFGroupsList.vue';
import TFGameplay from './TrueOrFalse/TFGameplay.vue';
import FPGameplay from './FourPictures/FPGameplay.vue';

type Screen = 'hub' | 'qa-groups' | 'qa-play' | 'tf-groups' | 'tf-play' | 'fp-play';

const store = useGamesStore();
const navBadges = useNavBadgesStore();
const activeScreen = ref<Screen>('hub');
const isDev = import.meta.env.DEV && window.isElectron;
const isResetting = ref(false);

onMounted(() => {
    store.init();
    // Visiting the game hub clears its nav dot for the next 10 hours.
    navBadges.markGamesVisited();
});
onUnmounted(() => store.dispose());

async function onDebugReset() {
    if (isResetting.value) return;
    if (!window.confirm('Reset ALL game progress and refill lives? (debug)')) return;
    isResetting.value = true;
    try {
        await store.resetAllProgress();
    } finally {
        isResetting.value = false;
    }
}

function goHub() {
    if (store.isBusy) return;
    store.exitGame();
    activeScreen.value = 'hub';
}
async function retryGame() {
    if (await store.retryAction() && store.gameState === 'playing') {
        if (store.activeGameType === 'qa') activeScreen.value = 'qa-play';
        if (store.activeGameType === 'tf') activeScreen.value = 'tf-play';
        if (store.activeGameType === 'fp') activeScreen.value = 'fp-play';
    }
}
function openQA() { activeScreen.value = 'qa-groups'; }
function openTF() { activeScreen.value = 'tf-groups'; }
async function openFP() {
    if (await store.startFPGame()) activeScreen.value = 'fp-play';
}
async function onQAGroupSelected(groupId: number) {
    if (await store.startQAGame(groupId)) activeScreen.value = 'qa-play';
}
async function onTFGroupSelected(groupId: number) {
    if (await store.startTFGame(groupId)) activeScreen.value = 'tf-play';
}
</script>

<template>
    <div class="h-full overflow-hidden p-4 max-w-2xl mx-auto flex flex-col">
        <div v-if="store.error" role="alert" class="mb-3 rounded-lg border border-red-400 p-3 text-sm space-y-2">
            <p>{{ store.error }}</p>
            <NButton size="small" :loading="store.isBusy" @click="retryGame">Try again</NButton>
        </div>
        <!-- Hub -->
        <div v-if="activeScreen === 'hub'" class="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            <h1 class="text-xl font-bold text-[var(--theme-text)] pt-1">Bible Games</h1>
            <LivesBar :lives="store.lives" :next-recovery-at="store.nextRecoveryAt" />
            <div v-if="store.isLoading" class="space-y-3">
                <div v-for="i in 3" :key="i" class="h-28 rounded-xl bg-[var(--theme-bg-soft)] animate-pulse" />
            </div>
            <template v-else>
                <p v-if="!store.qaGroups.length && !store.tfGroups.length && !store.fpLevels.length && !store.error" class="text-sm text-[var(--theme-text-soft)]">
                    Games will appear here when the questions are published.
                </p>
                <GameCard
                    title="Question & Answer"
                    description="Answer multiple-choice Bible questions and unlock new groups."
                    color="#3b82f6"
                    emoji="📖"
                    :progress="store.qaProgressSummary"
                    :disabled="store.isBusy || store.qaGroups.length === 0"
                    @play="openQA"
                />
                <GameCard
                    title="True or False"
                    description="Decide whether each Bible statement is true or false."
                    color="#10b981"
                    emoji="✅"
                    :progress="store.tfProgressSummary"
                    :disabled="store.isBusy || store.tfGroups.length === 0"
                    @play="openTF"
                />
                <GameCard
                    title="4 Pictures 1 Word"
                    description="Guess the Bible word from four picture clues."
                    color="#f59e0b"
                    emoji="🖼️"
                    :progress="store.fpProgressSummary"
                    :disabled="!store.canPlay || store.isBusy || !store.fpLevels.length"
                    :disabled-reason="!store.canPlay ? 'No hearts left. Wait for a heart to recover.' : undefined"
                    @play="openFP"
                />
            </template>

            <!-- Debug-only: reset all progress + lives (dev builds only) -->
            <NButton
                v-if="isDev"
                block
                dashed
                type="error"
                class="mt-2"
                :loading="isResetting"
                :focusable="false"
                @click="onDebugReset"
            >{{ isResetting ? 'Resetting…' : '⟳ Reset progress (debug)' }}</NButton>
        </div>

        <QAGroupsList
            v-else-if="activeScreen === 'qa-groups'"
            class="flex-1 min-h-0"
            @back="goHub"
            @select="onQAGroupSelected"
        />
        <QAGameplay
            v-else-if="activeScreen === 'qa-play'"
            class="flex-1 min-h-0 overflow-y-auto pr-1"
            @back="activeScreen = 'qa-groups'"
            @exit="goHub"
        />
        <TFGroupsList
            v-else-if="activeScreen === 'tf-groups'"
            class="flex-1 min-h-0"
            @back="goHub"
            @select="onTFGroupSelected"
        />
        <TFGameplay
            v-else-if="activeScreen === 'tf-play'"
            class="flex-1 min-h-0 overflow-y-auto pr-1"
            @back="activeScreen = 'tf-groups'"
            @exit="goHub"
        />
        <FPGameplay
            v-else-if="activeScreen === 'fp-play'"
            class="flex-1 min-h-0 overflow-y-auto pr-1"
            @exit="goHub"
        />
    </div>
</template>
