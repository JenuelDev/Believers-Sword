<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { NSpin, NModal, NSteps, NStep, useDialog } from 'naive-ui';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useBibleStore } from '../../store/BibleStore';
import { useDevotionStreakStore } from '../../store/devotionStreakStore';
import { bibleBooks } from '../../util/books';
import { getBibleService } from '../../services/BibleService';
import { useDevotionCompletion } from './useDevotionCompletion';

// Maps i18n locale names to ISO codes used in devotionals.db.
// Falls back to 'en' for any locale not in the DB.
const localeToLangCode: Record<string, string> = {
    English: 'en',
    Korean: 'ko',
    Portuguese: 'pt',
    Filipino: 'tl',
};

interface Devotional {
    id: number;
    title: string;
    day_number: number;
    pause: string;
    listen: string;
    think: string;
    pray: string;
    go_action: string;
    verses: string[];
}

const steps = [
    { key: 'pause', label: 'Pause', icon: 'mdi:pause-circle-outline' },
    { key: 'listen', label: 'Listen', icon: 'mdi:ear-hearing' },
    { key: 'think', label: 'Think', icon: 'mdi:head-lightbulb-outline' },
    { key: 'pray', label: 'Pray', icon: 'mdi:hands-pray' },
    { key: 'go', label: 'Go', icon: 'mdi:arrow-right-circle-outline' },
] as const;

const { locale, t } = useI18n();
const dialog = useDialog();
const devotional = ref<Devotional | null>(null);
const loading = ref(true);
const activeStep = ref(0);
const bibleStore = useBibleStore();
const devotionStreak = useDevotionStreakStore();

// The synced day remains authoritative even when it arrives after mount.
const { finished, saving, saveError, finishDevotion, readAgain } = useDevotionCompletion(
    () => devotionStreak.completedToday,
    () => devotionStreak.recordTodayCompleted(),
);

// "Start Devotion again" — confirm, then re-open the steps from the beginning.
function restartDevotion() {
    dialog.warning({
        title: t('Start Devotion again'),
        content: t("Do you want to go through today's devotion again?"),
        positiveText: t('Yes'),
        negativeText: t('No'),
        onPositiveClick: () => {
            readAgain();
            activeStep.value = 0;
        },
    });
}

const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function langCode(): string {
    return localeToLangCode[locale.value] ?? 'en';
}

function hasVisibleText(html: string): boolean {
    return html.replace(/<[^>]*>/g, '').trim().length > 0;
}

// Verse preview modal
const showVerseModal = ref(false);
const verseModalTitle = ref('');
const verseModalLoading = ref(false);
const verseModalTexts = ref<Array<{ version: string; text: string }>>([]);

const today = new Date();
const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

// When today's devotion is done, the next one unlocks tomorrow.
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
const tomorrowLabel = tomorrow.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

const stepContent = computed(() => {
    if (!devotional.value) return '';
    const d = devotional.value;
    const keys: Record<string, string> = {
        pause: d.pause,
        listen: d.listen,
        think: d.think,
        pray: d.pray,
        go: d.go_action,
    };
    return keys[steps[activeStep.value].key] || '';
});

function nextStep() {
    if (activeStep.value < steps.length - 1) {
        activeStep.value++;
    }
}

function prevStep() {
    if (activeStep.value > 0) {
        activeStep.value--;
    }
}

async function openVersePreview(verseRef: string) {
    const parts = verseRef.split(':');
    if (parts.length < 2) return;
    const bookName = parts[0].replace(/_/g, ' ');
    const chapter = parseInt(parts[1]);
    const verseNum = parts[2] ? parseInt(parts[2]) : null;

    const book = bibleBooks.find(
        (b) =>
            b.title.toLowerCase() === bookName.toLowerCase() ||
            b.short_name.toLowerCase() === bookName.toLowerCase()
    );
    if (!book) return;

    verseModalTitle.value = verseRef.replace(/:/g, ' ');
    verseModalTexts.value = [];
    verseModalLoading.value = true;
    showVerseModal.value = true;

    try {
        const bibleService = getBibleService();
        const rows = await bibleService.getVerses({
            bible_versions: bibleStore.selectedBibleVersions,
            book_number: book.book_number,
            selected_chapter: chapter,
        });

        if (verseNum && rows.length) {
            const row = rows.find((r: any) => r.verse === verseNum);
            if (row) {
                verseModalTexts.value = (row.version || [])
                    .filter((v: any) => v.text && hasVisibleText(v.text))
                    .map((v: any) => ({
                        version: v.version.replace('.SQLite3', ''),
                        text: v.text,
                    }));
            }
        } else if (rows.length) {
            verseModalTexts.value = rows.flatMap((r: any) =>
                (r.version || [])
                    .filter((v: any) => v.text && hasVisibleText(v.text))
                    .map((v: any) => ({
                        version: `${v.version.replace('.SQLite3', '')} — v${r.verse}`,
                        text: v.text,
                    }))
            );
        }
    } finally {
        verseModalLoading.value = false;
    }
}

async function loadTodayDevotional() {
    loading.value = true;
    try {
        devotional.value = await window.browserWindow.getTodayDevotional(langCode());
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadTodayDevotional();
    // If today's devotion is already done, open straight to the completion view.
    void devotionStreak.loadDays();
    window.addEventListener('focus', refreshWebDays);
    window.addEventListener('online', refreshWebDays);
});

// Web storage is REST-backed, including for accounts without automatic sync.
function refreshWebDays() {
    if (!window.isElectron) void devotionStreak.loadDays();
}

onBeforeUnmount(() => {
    window.removeEventListener('focus', refreshWebDays);
    window.removeEventListener('online', refreshWebDays);
});

watch(locale, loadTodayDevotional);
</script>

<template>
    <div class="daily-devotional h-full overflow-auto">
        <div class="devo-container">
            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-20">
                <NSpin size="medium" />
            </div>

            <!-- No content -->
            <div v-else-if="!devotional" class="text-center opacity-50 py-20">
                <Icon icon="mdi:book-off-outline" class="text-5xl mb-3" />
                <p>No devotional found for today.</p>
            </div>

            <template v-else>
                <!-- In-progress devotion — hidden once finished -->
                <template v-if="!finished">
                <!-- Header -->
                <div class="devo-header">
                    <p class="devo-date">{{ dateLabel }}</p>
                    <span class="devo-day-badge">{{ $t('Day') }} {{ devotional.day_number }}</span>
                    <h1 class="devo-title">{{ devotional.title }}</h1>

                    <!-- Verse chips -->
                    <div v-if="devotional.verses?.length" class="devo-verses">
                        <button
                            v-for="verse in devotional.verses"
                            :key="verse"
                            class="verse-chip"
                            :title="`${verse.replace(/:/g, ' ')}`"
                            @click="openVersePreview(verse)"
                        >
                            <Icon icon="mdi:book-open-variant" class="text-xs" />
                            {{ verse.replace(/:/g, ' ') }}
                        </button>
                    </div>
                </div>

                <!-- Step progress bar -->
                <NSteps :current="activeStep + 1" class="devo-steps" size="small">
                    <NStep
                        v-for="(step, i) in steps"
                        :key="step.key"
                        :title="t(step.label)"
                        @click="activeStep = i"
                        style="cursor: pointer"
                    />
                </NSteps>

                <!-- Content area -->
                <div class="devo-content-area">
                    <div class="devo-content-accent" />
                    <div class="devo-content-inner">
                        <h3 class="devo-step-label">{{ $t(steps[activeStep].label) }}</h3>
                        <div class="devo-step-body" v-html="stepContent"></div>
                    </div>
                </div>

                <p v-if="saveError" role="alert" class="text-center text-red-500 mb-3">
                    {{ saveError }}
                </p>

                <!-- Navigation -->
                <div class="devo-nav">
                    <button
                        v-if="activeStep > 0"
                        class="devo-nav-btn"
                        @click="prevStep"
                    >
                        <Icon icon="mdi:arrow-left" class="text-sm" />
                        {{ $t('Back') }}
                    </button>
                    <span v-else />
                    <button
                        v-if="activeStep < steps.length - 1"
                        class="devo-nav-btn devo-nav-btn-primary"
                        @click="nextStep"
                    >
                        {{ $t('Next') }}
                        <Icon icon="mdi:arrow-right" class="text-sm" />
                    </button>
                    <button
                        v-else
                        class="devo-nav-btn devo-nav-btn-primary"
                        :disabled="saving"
                        @click="finishDevotion"
                    >
                        <Icon icon="mdi:check-circle" class="text-sm" />
                        {{ $t('Finish') }}
                    </button>
                </div>
                </template>

                <!-- Completion-only view — today's devotion is done -->
                <div v-else class="devo-complete">
                    <div class="devo-complete-badge">
                        <Icon icon="mdi:check-circle" />
                    </div>
                    <h2 class="devo-complete-title">{{ $t("Today's devotion complete!") }}</h2>
                    <p class="devo-complete-sub">
                        {{ $t('Come back later or tomorrow for your next devotion.') }}
                    </p>
                    <div class="devo-complete-next">
                        <Icon icon="mdi:calendar-arrow-right" class="text-sm" />
                        <span>{{ $t('Next devotion') }} · {{ tomorrowLabel }}</span>
                    </div>

                    <div class="devo-streak-count">{{ devotionStreak.currentStreak }}</div>
                    <div class="devo-streak-label">{{ $t('day streak') }}</div>
                    <div class="devo-streak-week">
                        <div
                            v-for="(d, i) in devotionStreak.weekDays"
                            :key="i"
                            class="devo-streak-day"
                        >
                            <span class="devo-streak-dow">{{ weekLabels[i] }}</span>
                            <span
                                class="devo-streak-pip"
                                :class="{ filled: d.completed, today: d.isToday }"
                            >
                                <Icon v-if="d.completed" icon="mdi:check" />
                                <template v-else>{{ d.date.getDate() }}</template>
                            </span>
                        </div>
                    </div>

                    <button class="devo-restart" @click="restartDevotion">
                        <Icon icon="mdi:refresh" class="text-sm" />
                        {{ $t('Start Devotion again') }}
                    </button>
                </div>
            </template>
        </div>

        <!-- Verse Preview Modal -->
        <NModal v-model:show="showVerseModal" preset="card" class="verse-preview-modal" :style="{ maxWidth: '520px' }">
            <template #header>
                <div class="flex items-center gap-2">
                    <Icon icon="mdi:book-open-page-variant" class="text-[var(--primary-color)]" />
                    <span>{{ verseModalTitle }}</span>
                </div>
            </template>
            <div v-if="verseModalLoading" class="flex justify-center py-8">
                <NSpin size="small" />
            </div>
            <div v-else-if="verseModalTexts.length === 0" class="text-center opacity-50 py-6">
                Verse not found in your current Bible version.
            </div>
            <div v-else class="verse-preview-list">
                <div
                    v-for="(item, i) in verseModalTexts"
                    :key="i"
                    class="verse-preview-item"
                >
                    <div class="verse-preview-version">{{ item.version }}</div>
                    <div class="verse-preview-text" v-html="item.text"></div>
                </div>
            </div>
        </NModal>
    </div>
</template>

<style scoped src="./daily-devotional.css"></style>
