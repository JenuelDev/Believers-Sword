import { ref, computed, type Ref } from 'vue';
import type { GameType, GameState, FPLevel } from './types';
import { playSound } from './sound';
import correctSoundUrl from '../../assets/sounds/correct.mp3';
import wrongSoundUrl from '../../assets/sounds/wrong.mp3';

export function createFourPictures(deps: {
    canPlay: Ref<boolean>; gameState: Ref<GameState>; activeGameType: Ref<GameType | null>;
    newlyPassed: Ref<boolean>; lives: Ref<number>; loseLife: () => Promise<void>;
    blocked: Ref<boolean>; runAction: (work: () => Promise<void>) => Promise<boolean>;
}) {
    const { canPlay, gameState, activeGameType, newlyPassed, lives, loseLife } = deps;
    const fpLevels = ref<FPLevel[]>([]);
    const fpSolvedIds = ref<Set<number>>(new Set());
    const fpImagesBasePath = ref('');

    // ── FP active state ──────────────────────────────────────────────────────
    const currentFpLevelIndex = ref(0);
    const fpGuessedLetters = ref<string[]>([]);
    const fpScrambledLetters = ref<string[]>([]);
    // Whether each tray tile has been consumed (one letter per tile).
    const fpTrayUsed = ref<boolean[]>([]);
    // For each answer slot, which tray tile filled it (so clearing frees the tile).
    const fpSlotTray = ref<(number | null)[]>([]);

    const fpProgressSummary = computed(() => ({
        completed: fpLevels.value.filter((level) => fpSolvedIds.value.has(level.id)).length,
        total: fpLevels.value.length,
    }));
    const currentFpLevel = computed((): FPLevel | null => {
        const unsolved = fpLevels.value.filter((l) => !fpSolvedIds.value.has(l.id));
        return unsolved[currentFpLevelIndex.value] ?? null;
    });

    async function loadFPData() {
        const [levels, solvedIds, basePath] = await Promise.all([
            window.browserWindow.fpGetLevels(),
            window.browserWindow.fpGetSolvedLevelIds(),
            window.browserWindow.fpGetImagesBasePath(),
        ]);
        fpLevels.value = levels;
        fpSolvedIds.value = new Set(solvedIds);
        fpImagesBasePath.value = basePath;
    }

    // ── Four Pictures flow ─────────────────────────────────────────────────
    function buildFPScramble(word: string): string[] {
        const letters = word.toUpperCase().split('');
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const target = Math.max(12, letters.length);
        while (letters.length < target) {
            letters.push(alphabet[Math.floor(Math.random() * 26)]);
        }
        for (let j = letters.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [letters[j], letters[k]] = [letters[k], letters[j]];
        }
        return letters;
    }

    function loadFpLevelIntoState() {
        const level = currentFpLevel.value;
        if (!level) return;
        fpGuessedLetters.value = new Array(level.word.length).fill('');
        fpScrambledLetters.value = buildFPScramble(level.word);
        fpTrayUsed.value = new Array(fpScrambledLetters.value.length).fill(false);
        fpSlotTray.value = new Array(level.word.length).fill(null);
    }

    // Clear all placed letters, freeing every tray tile (used when a guess is wrong).
    function clearFpGuess() {
        fpGuessedLetters.value = fpGuessedLetters.value.map(() => '');
        fpSlotTray.value = fpSlotTray.value.map(() => null);
        fpTrayUsed.value = fpTrayUsed.value.map(() => false);
    }

    async function refreshSolved() {
        fpSolvedIds.value = new Set(await window.browserWindow.fpGetSolvedLevelIds());
    }

    async function startFPGame() {
        await refreshSolved();
        if (!canPlay.value) throw new Error('No lives remain. Please wait for a life to recover.');
        activeGameType.value = 'fp';
        currentFpLevelIndex.value = 0;
        newlyPassed.value = false;
        const level = currentFpLevel.value;
        if (!level) {
            gameState.value = 'completed';
            return;
        }
        loadFpLevelIntoState();
        gameState.value = 'playing';
    }

    // Place a specific tray tile (by index) into the next empty answer slot and
    // mark that tile as consumed so it can't be used again.
    function fpTapTrayLetter(trayIndex: number) {
        if (gameState.value !== 'playing' || deps.blocked.value) return;
        if (fpTrayUsed.value[trayIndex]) return;
        const emptyIndex = fpGuessedLetters.value.findIndex((l) => l === '');
        if (emptyIndex === -1) return;

        const nextGuess = [...fpGuessedLetters.value];
        nextGuess[emptyIndex] = fpScrambledLetters.value[trayIndex];
        fpGuessedLetters.value = nextGuess;

        const nextSlotTray = [...fpSlotTray.value];
        nextSlotTray[emptyIndex] = trayIndex;
        fpSlotTray.value = nextSlotTray;

        const nextUsed = [...fpTrayUsed.value];
        nextUsed[trayIndex] = true;
        fpTrayUsed.value = nextUsed;

        void deps.runAction(checkFPAnswer);
    }

    // Keyboard entry: consume the first unused tray tile matching the letter.
    function fpTapLetter(letter: string) {
        if (gameState.value !== 'playing' || deps.blocked.value) return;
        const trayIndex = fpScrambledLetters.value.findIndex(
            (l, i) => l === letter && !fpTrayUsed.value[i],
        );
        if (trayIndex === -1) return;
        fpTapTrayLetter(trayIndex);
    }

    function fpRemoveLetter(index: number) {
        if (gameState.value !== 'playing' || deps.blocked.value) return;
        if (fpGuessedLetters.value[index] === '') return;

        const trayIndex = fpSlotTray.value[index];
        if (trayIndex != null) {
            const nextUsed = [...fpTrayUsed.value];
            nextUsed[trayIndex] = false;
            fpTrayUsed.value = nextUsed;
        }

        const nextGuess = [...fpGuessedLetters.value];
        nextGuess[index] = '';
        fpGuessedLetters.value = nextGuess;

        const nextSlotTray = [...fpSlotTray.value];
        nextSlotTray[index] = null;
        fpSlotTray.value = nextSlotTray;
    }

    async function checkFPAnswer() {
        const level = currentFpLevel.value;
        if (!level) return;
        const guessed = fpGuessedLetters.value.join('').toUpperCase();
        if (guessed.length < level.word.length || fpGuessedLetters.value.some((l) => l === '')) return;

        if (guessed === level.word.toUpperCase()) {
            playSound(correctSoundUrl);
            await window.browserWindow.fpMarkLevelSolved(level.id);
            fpSolvedIds.value = new Set([...fpSolvedIds.value, level.id]);
            const remaining = fpLevels.value.filter((l) => !fpSolvedIds.value.has(l.id));
            if (remaining.length === 0) {
                gameState.value = 'completed';
            } else {
                currentFpLevelIndex.value = 0;
                loadFpLevelIntoState();
            }
        } else {
            playSound(wrongSoundUrl);
            await loseLife();
            if (lives.value <= 0) {
                gameState.value = 'gameOver';
                return;
            }
            clearFpGuess();
        }
    }


    function reset() {
        fpGuessedLetters.value = []; fpScrambledLetters.value = [];
        fpTrayUsed.value = []; fpSlotTray.value = [];
    }
    return { fpLevels, fpSolvedIds, fpImagesBasePath, fpProgressSummary, currentFpLevel,
        fpGuessedLetters, fpScrambledLetters, fpTrayUsed, startFPGame, fpTapLetter,
        fpTapTrayLetter, fpRemoveLetter, loadFPData, refreshSolved, reset };
}
