import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import correctSoundUrl from '../assets/sounds/correct.mp3';
import wrongSoundUrl from '../assets/sounds/wrong.mp3';

import type { GameType, GameState, GroupProgress, QAQuestion, TFStatement } from './games/types';
import { playSound } from './games/sound';
import { createFourPictures } from './games/fourPictures';

export const useGamesStore = defineStore('useGamesStore', () => {
    // ── Lives ──────────────────────────────────────────────────────────────
    const lives = ref(7);
    const nextRecoveryAt = ref<string | null>(null);
    const isLoading = ref(false);
    const isBusy = ref(false);
    const error = ref('');
    let retry: (() => Promise<boolean>) | null = null;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Catalog + progress ───────────────────────────────────────────────────
    const qaGroups = ref<Array<{ id: number; name: string; display_order: number; required_completed: number; passing_score: number }>>([]);
    const qaGroupProgress = ref<Record<number, GroupProgress>>({});
    const tfGroups = ref<Array<{ id: number; name: string; display_order: number; required_completed: number; passing_score: number }>>([]);
    const tfGroupProgress = ref<Record<number, GroupProgress>>({});
    // ── Active game state ──────────────────────────────────────────────────
    const activeGameType = ref<GameType | null>(null);
    const currentGroupId = ref<number | null>(null);
    const gameState = ref<GameState>('idle');
    const currentItems = ref<Array<QAQuestion | TFStatement>>([]);
    const currentIndex = ref(0);
    const score = ref(0);
    const streak = ref(0);
    const bestStreak = ref(0);
    const lastAnswerCorrect = ref<boolean | null>(null);
    const selectedAnswerIndex = ref<number | null>(null);
    const shuffledOptions = ref<string[]>([]);
    const shuffledCorrectIndex = ref(0);
    const newlyPassed = ref(false);

    // ── Computed ─────────────────────────────────────────────────────────────
    const qaProgressSummary = computed(() => ({
        completed: Object.values(qaGroupProgress.value).filter((p) => p.is_completed).length,
        total: qaGroups.value.length,
    }));
    const tfProgressSummary = computed(() => ({
        completed: Object.values(tfGroupProgress.value).filter((p) => p.is_completed).length,
        total: tfGroups.value.length,
    }));
    const currentQuestion = computed((): QAQuestion | TFStatement | null =>
        currentIndex.value < currentItems.value.length ? currentItems.value[currentIndex.value] : null,
    );
    const totalItems = computed(() => currentItems.value.length);
    const canPlay = computed(() => lives.value > 0);
    const scorePercentage = computed(() =>
        totalItems.value === 0 ? 0 : Math.round((score.value / totalItems.value) * 100),
    );
    const fp = createFourPictures({ canPlay, gameState, activeGameType, newlyPassed, lives, loseLife,
        blocked: computed(() => isBusy.value || Boolean(error.value)), runAction: (work) => action(work)() });
    const { fpLevels, fpSolvedIds, fpImagesBasePath, fpProgressSummary, currentFpLevel,
        fpGuessedLetters, fpScrambledLetters, fpTrayUsed, startFPGame, fpTapLetter,
        fpTapTrayLetter, fpRemoveLetter, loadFPData } = fp;

    function qaIsGroupUnlocked(groupId: number) {
        const group = qaGroups.value.find((g) => g.id === groupId);
        if (!group || group.required_completed === 0) return true;
        return Object.values(qaGroupProgress.value).filter((p) => p.is_completed).length >= group.required_completed;
    }
    function tfIsGroupUnlocked(groupId: number) {
        const group = tfGroups.value.find((g) => g.id === groupId);
        if (!group || group.required_completed === 0) return true;
        return Object.values(tfGroupProgress.value).filter((p) => p.is_completed).length >= group.required_completed;
    }

    // ── Lives helpers ──────────────────────────────────────────────────────
    function scheduleRecoveryTimer() {
        if (recoveryTimer) clearTimeout(recoveryTimer);
        if (!nextRecoveryAt.value) return;
        const delay = new Date(nextRecoveryAt.value).getTime() - Date.now();
        if (delay <= 0) {
            void refreshLives().catch((cause) => { error.value = cause.message; });
            return;
        }
        // Cap the timer so a far-future recovery still re-checks periodically.
        recoveryTimer = setTimeout(() => void refreshLives().catch((cause) => { error.value = cause.message; }), Math.min(delay + 500, 2_147_483_000));
    }

    async function refreshLives() {
        lives.value = await window.browserWindow.gameGetLives();
        nextRecoveryAt.value = await window.browserWindow.gameNextRecoveryAt();
        scheduleRecoveryTimer();
    }

    async function loseLife() {
        lives.value = await window.browserWindow.gameLoseLife();
        nextRecoveryAt.value = await window.browserWindow.gameNextRecoveryAt();
        scheduleRecoveryTimer();
    }

    // ── Data loading ───────────────────────────────────────────────────────
    async function loadQAData() {
        const [groups, progress] = await Promise.all([
            window.browserWindow.qaGetGroups(),
            window.browserWindow.qaGetAllGroupProgress(),
        ]);
        qaGroups.value = groups;
        qaGroupProgress.value = Object.fromEntries(progress.map((p) => [p.group_id, p]));
    }
    async function loadTFData() {
        const [groups, progress] = await Promise.all([
            window.browserWindow.tfGetGroups(),
            window.browserWindow.tfGetAllGroupProgress(),
        ]);
        tfGroups.value = groups;
        tfGroupProgress.value = Object.fromEntries(progress.map((p) => [p.group_id, p]));
    }
    async function init() {
        exitGame();
        isLoading.value = true;
        try {
            await Promise.all([refreshLives(), loadQAData(), loadTFData(), loadFPData()]);
        } finally {
            isLoading.value = false;
        }
    }

    // Refresh lives + synced progress after a pull sync, without touching an
    // in-progress game. Active Four Pictures clues stay fixed until exit.
    async function refreshAfterSync() {
        await Promise.all([refreshLives(), loadQAData(), loadTFData(),
            ...(activeGameType.value === 'fp' && gameState.value === 'playing' ? [] : [fp.refreshSolved()])]);
    }

    // ── Q&A flow ───────────────────────────────────────────────────────────
    function shuffleQAOptions(q: QAQuestion) {
        const indexed = q.options.map((opt, i) => ({ i, opt }));
        for (let j = indexed.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [indexed[j], indexed[k]] = [indexed[k], indexed[j]];
        }
        shuffledOptions.value = indexed.map((x) => x.opt);
        shuffledCorrectIndex.value = indexed.findIndex((x) => x.i === q.answer);
    }

    function resetRoundState() {
        currentIndex.value = 0;
        score.value = 0;
        streak.value = 0;
        bestStreak.value = 0;
        lastAnswerCorrect.value = null;
        selectedAnswerIndex.value = null;
        newlyPassed.value = false;
    }

    async function startQAGame(groupId: number) {
        if (!canPlay.value) throw new Error('No lives remain. Please wait for a life to recover.');
        activeGameType.value = 'qa';
        currentGroupId.value = groupId;
        if (!qaIsGroupUnlocked(groupId)) throw new Error('Complete earlier groups to unlock this group.');
        const questions = await window.browserWindow.qaGetQuestionsForGroup(groupId);
        if (!questions.length) throw new Error('This group has no published questions yet.');
        currentItems.value = questions;
        resetRoundState();
        if (questions.length) shuffleQAOptions(questions[0] as QAQuestion);
        gameState.value = 'playing';
    }

    async function submitQAAnswer(answerIndex: number) {
        if (gameState.value !== 'playing') return;
        const correct = answerIndex === shuffledCorrectIndex.value;
        if (!correct) await loseLife();
        selectedAnswerIndex.value = answerIndex;
        lastAnswerCorrect.value = correct;
        if (correct) {
            score.value++;
            streak.value++;
            if (streak.value > bestStreak.value) bestStreak.value = streak.value;
            playSound(correctSoundUrl);
        } else {
            streak.value = 0;
            playSound(wrongSoundUrl);
        }
        gameState.value = 'answered';
    }

    async function finalizeQAGame() {
        if (currentGroupId.value == null) return;
        const group = qaGroups.value.find((g) => g.id === currentGroupId.value);
        if (!group) return;
        const result = await window.browserWindow.qaSaveGroupProgress({
            groupId: currentGroupId.value,
            correctCount: score.value,
            totalCount: totalItems.value,
            passingScore: group.passing_score,
        });
        newlyPassed.value = result.newlyPassed;
        await loadQAData();
    }

    async function nextQAQuestion() {
        if (gameState.value !== 'answered') return;
        selectedAnswerIndex.value = null;
        lastAnswerCorrect.value = null;
        if (lives.value <= 0) {
            await finalizeQAGame();
            gameState.value = 'gameOver';
            return;
        }
        if (currentIndex.value + 1 >= currentItems.value.length) {
            await finalizeQAGame();
            gameState.value = 'completed';
        } else {
            currentIndex.value++;
            shuffleQAOptions(currentItems.value[currentIndex.value] as QAQuestion);
            gameState.value = 'playing';
        }
    }

    // ── True/False flow ──────────────────────────────────────────────────────
    async function startTFGame(groupId: number) {
        if (!canPlay.value) throw new Error('No lives remain. Please wait for a life to recover.');
        activeGameType.value = 'tf';
        currentGroupId.value = groupId;
        if (!tfIsGroupUnlocked(groupId)) throw new Error('Complete earlier groups to unlock this group.');
        const statements = await window.browserWindow.tfGetStatementsForGroup(groupId);
        if (!statements.length) throw new Error('This group has no published questions yet.');
        currentItems.value = statements;
        resetRoundState();
        gameState.value = 'playing';
    }

    async function submitTFAnswer(isTrue: boolean) {
        if (gameState.value !== 'playing') return;
        const stmt = currentItems.value[currentIndex.value] as TFStatement;
        const correct = (isTrue ? 1 : 0) === stmt.answer;
        if (!correct) await loseLife();
        selectedAnswerIndex.value = isTrue ? 1 : 0;
        lastAnswerCorrect.value = correct;
        if (correct) {
            score.value++;
            streak.value++;
            if (streak.value > bestStreak.value) bestStreak.value = streak.value;
            playSound(correctSoundUrl);
        } else {
            streak.value = 0;
            playSound(wrongSoundUrl);
        }
        gameState.value = 'answered';
    }

    async function finalizeTFGame() {
        if (currentGroupId.value == null) return;
        const group = tfGroups.value.find((g) => g.id === currentGroupId.value);
        if (!group) return;
        const result = await window.browserWindow.tfSaveGroupProgress({
            groupId: currentGroupId.value,
            correctCount: score.value,
            totalCount: totalItems.value,
            passingScore: group.passing_score,
        });
        newlyPassed.value = result.newlyPassed;
        await loadTFData();
    }

    async function nextTFQuestion() {
        if (gameState.value !== 'answered') return;
        selectedAnswerIndex.value = null;
        lastAnswerCorrect.value = null;
        if (lives.value <= 0) {
            await finalizeTFGame();
            gameState.value = 'gameOver';
            return;
        }
        if (currentIndex.value + 1 >= currentItems.value.length) {
            await finalizeTFGame();
            gameState.value = 'completed';
        } else {
            currentIndex.value++;
            gameState.value = 'playing';
        }
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────
    function exitGame() {
        gameState.value = 'idle';
        activeGameType.value = null;
        currentGroupId.value = null;
        currentItems.value = [];
        resetRoundState();
        shuffledOptions.value = [];
        shuffledCorrectIndex.value = 0;
        fp.reset();
        error.value = ''; retry = null;
    }

    function dispose() {
        if (recoveryTimer) clearTimeout(recoveryTimer);
        recoveryTimer = null;
        if (!window.isElectron) {
            exitGame(); qaGroups.value = []; tfGroups.value = [];
            qaGroupProgress.value = {}; tfGroupProgress.value = {};
        }
    }

    // Debug: wipe all progress + refill lives, then reload the catalog.
    async function resetAllProgress() {
        if (!window.isElectron) return;
        exitGame();
        await window.browserWindow.gameResetProgress();
        await init();
    }

    function action<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
        return async (...args: T): Promise<boolean> => {
            if (isBusy.value) return false;
            isBusy.value = true; error.value = '';
            retry = () => action(fn)(...args);
            try { await fn(...args); retry = null; return true; }
            catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not save your game. Try again.'; return false; }
            finally { isBusy.value = false; }
        };
    }
    async function retryAction() { return retry ? retry() : false; }

    return {
        // Lives
        lives, nextRecoveryAt, isLoading, refreshLives, loseLife,
        // Q&A
        qaGroups, qaGroupProgress, qaProgressSummary, qaIsGroupUnlocked,
        startQAGame: action(startQAGame), submitQAAnswer: action(submitQAAnswer), nextQAQuestion: action(nextQAQuestion),
        // T/F
        tfGroups, tfGroupProgress, tfProgressSummary, tfIsGroupUnlocked,
        startTFGame: action(startTFGame), submitTFAnswer: action(submitTFAnswer), nextTFQuestion: action(nextTFQuestion),
        // FP
        fpLevels, fpSolvedIds, fpImagesBasePath, fpProgressSummary,
        currentFpLevel, fpGuessedLetters, fpScrambledLetters, fpTrayUsed,
        startFPGame: action(startFPGame), fpTapLetter, fpTapTrayLetter, fpRemoveLetter,
        // Shared game state
        activeGameType, currentGroupId, gameState, currentQuestion,
        totalItems, canPlay, scorePercentage, score, streak, bestStreak,
        lastAnswerCorrect, selectedAnswerIndex, shuffledOptions, shuffledCorrectIndex,
        currentIndex, newlyPassed, exitGame,
        // Lifecycle
        init: action(init), refreshAfterSync, dispose, resetAllProgress, isBusy, error, retryAction,
    };
});
