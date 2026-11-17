<script lang="ts">
import { defineComponent } from 'vue';
import { useViewVerses } from './useViewVerses';
import { viewVerseComponents } from './viewVerseComponents';

export default defineComponent({ components: viewVerseComponents, setup: useViewVerses });
</script>
<template>
    <div
        class="w-full h-full show-chapter-verses flex flex-col read-bible-verses-panel"
        :class="{ 'show-strongs': settingStore.showStrongsNumbers }"
    >
        <div
            class="dark:bg-dark-400 flex items-center py-6px select-none px-10px read-bible-verses-toolbar"
        >
            <div class="flex-shrink-0">
                <NButton
                    size="small"
                    quaternary
                    circle
                    :title="$t('Before')"
                    @click="navigateChapter('before')"
                >
                    <template #icon>
                        <NIcon :component="FastForward20Regular" size="20" class="rotate-180" />
                    </template>
                </NButton>
            </div>
            <div class="flex flex-wrap items-center gap-5px flex-1 min-w-0 mx-8px justify-center">
                <div
                    class="flex items-center gap-5px flex-shrink-0"
                    style="width: clamp(100px, 20%, 200px)"
                >
                    <NSlider v-model:value="fontSize" :max="35" :min="10" class="flex-1" />
                    <span class="text-xs flex-shrink-0">{{ fontSize }}</span>
                </div>
                <div class="flex-shrink-0" style="width: clamp(100px, 25%, 250px)">
                    <NSelect
                        v-model:value="fontSelected"
                        :options="fontOptions"
                        size="small"
                        filterable
                        :virtual-scroll="false"
                        :render-label="
                            (option: any) =>
                                h(
                                    'span',
                                    { style: `font-family: '${option.value}'` },
                                    option.label as string,
                                )
                        "
                    />
                </div>
                <VerseSelector ref="verseSelectorRef" circle>
                    <NIcon
                        size="25"
                        :component="themeStore.isDark ? SlideSearch28Filled : SlideSearch28Regular"
                    />
                </VerseSelector>
                <NButton
                    size="small"
                    quaternary
                    class="flex-shrink-0 mr-4px"
                    title="Open as Flipbook"
                    @click="flipbookStore.openVersionSelect()"
                >
                    <template #icon>
                        <Icon icon="mdi:book-open-page-variant" style="font-size: 24px" />
                    </template>
                </NButton>
                <NButton
                    size="small"
                    quaternary
                    class="flex-shrink-0"
                    :title="voiceReaderLabel + ' , Click to change'"
                    @click="
                        mainStore.settingsTab = 'VerseReader';
                        mainStore.showSettings = true;
                    "
                >
                    <template #icon>
                        <Icon icon="mdi:account-voice" style="font-size: 24px" />
                    </template>
                    <span class="text-xs whitespace-nowrap">{{ voiceReaderLabel }}</span>
                </NButton>
                <NButton
                    v-if="settingStore.verseReaderMode === 'piper-tts' && piperStore.isInstalled"
                    size="small"
                    quaternary
                    class="flex-shrink-0"
                    title="Voice Models"
                    @click="showPiperModels = true"
                >
                    <template #icon>
                        <Icon icon="mdi:account-voice" style="font-size: 18px" />
                    </template>
                    <span class="text-xs whitespace-nowrap">{{ piperVoiceLabel }}</span>
                </NButton>
                <NButton
                    v-if="bibleStore.selectedBibleVersions.length < 6"
                    size="small"
                    quaternary
                    class="flex-shrink-0"
                    title="Add Split View"
                    @click="addSplit"
                >
                    <template #icon>
                        <Icon icon="mdi:book-plus" style="font-size: 22px" />
                    </template>
                </NButton>
            </div>
            <div class="flex-shrink-0">
                <NButton
                    size="small"
                    quaternary
                    circle
                    :title="$t('Next')"
                    @click="navigateChapter('next')"
                >
                    <template #icon>
                        <NIcon :component="FastForward20Regular" size="20" />
                    </template>
                </NButton>
            </div>
        </div>
        <div
            id="view-verses-container"
            class="w-full flex-1 min-h-0"
        >
            <Splitpanes
                class="h-full split-view-panes"
                :dbl-click-splitter="false"
                @resized="onSplitResized"
            >
                <Pane
                    v-for="(versionFile, paneIndex) in bibleStore.selectedBibleVersions.slice(0, 6)"
                    :key="versionFile"
                    :size="splitPaneSizes[paneIndex] ?? (100 / bibleStore.selectedBibleVersions.length)"
                >
                    <div class="h-full flex flex-col">
                        <!-- Pane header: version selector -->
                        <div class="flex items-center gap-4px px-6px py-4px dark:bg-dark-400 bg-gray-100 border-b border-gray-200 dark:border-dark-200 select-none split-pane-header">
                            <NButton
                                size="small"
                                secondary
                                class="flex-1 !justify-between min-w-0"
                                @click="openVersionPicker(paneIndex)"
                            >
                                <span class="truncate">{{ versionTitle(versionFile) }}</span>
                                <template #icon>
                                    <NIcon size="16"><Icon icon="lucide:book-open-text" /></NIcon>
                                </template>
                            </NButton>
                            <NButton
                                v-if="bibleStore.selectedBibleVersions.length > 1"
                                size="tiny"
                                quaternary
                                circle
                                title="Remove split"
                                @click="removeSplit(paneIndex)"
                            >
                                <template #icon>
                                    <NIcon size="14"><Close /></NIcon>
                                </template>
                            </NButton>
                        </div>
                        <!-- Scrollable verse list for this pane -->
                        <div
                            :ref="(el) => setScrollPaneRef(paneIndex, el)"
                            class="flex-1 min-h-0 scroll-bar-md flex flex-col gap-5px overflow-y-auto overflowing-div pb-20px read-bible-verse-scroll-pane"
                            @mouseenter="onPaneMouseEnter(paneIndex)"
                            @pointerdown="onPaneMouseEnter(paneIndex)"
                            @scroll="syncScroll(paneIndex)"
                        >
                            <template v-if="showVerseSkeletons(paneIndex)">
                                <div
                                    v-for="row in verseSkeletonRows"
                                    :key="`verse-skeleton-${paneIndex}-${row}`"
                                    class="mx-10px verse-loading-skeleton"
                                    aria-hidden="true"
                                >
                                    <div class="verse-loading-number"></div>
                                    <div class="verse-loading-content">
                                        <div class="verse-loading-line w-92"></div>
                                        <div class="verse-loading-line w-76"></div>
                                        <div class="verse-loading-line w-58"></div>
                                    </div>
                                </div>
                            </template>
                            <template v-else-if="!paneHasVisibleVerses(paneIndex)">
                                <div
                                    class="mx-10px mt-16px rounded border px-12px py-10px text-size-13px"
                                    style="border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.12); color: #f59e0b;"
                                >
                                    This Bible version does not contain
                                    {{ bibleStore.selectedBook.title }} {{ bibleStore.selectedChapter }}.
                                </div>
                            </template>
                            <template v-else>
                                <div
                                    v-for="(verse, verseIndex) in bibleStore.renderVerses"
                                    :key="verse.verse"
                                    class="flex flex-col w-full mx-auto"
                                >
                                <div class="mx-10px">
                                    <div
                                        :class="{
                                            'rounded-t-md': clipNoteRender(
                                                `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                            ),
                                            'dark:bg-light-50 dark:bg-opacity-10 bg-gray-600 bg-opacity-10':
                                                bibleStore.selectedVerse === verse.verse,
                                            'the-selected-verse':
                                                bibleStore.selectedVerse === verse.verse,
                                            'verse-multi-selected': selectedVersesSet.has(verse.verse),
                                        }"
                                        :data-book="verse.book_number"
                                        :data-chapter="verse.chapter"
                                        :data-verse="verse.verse"
                                        :id="
                                            paneIndex === 0 && bibleStore.selectedVerse === verse.verse
                                                ? 'the-selected-verse'
                                                : undefined
                                        "
                                        :style="[
                                            `border: 1px solid ${clipNoteRender(`${verse.book_number}_${verse.chapter}_${verse.verse}`).color}`,
                                            bibleStore.selectedVerse === verse.verse ? 'border-left: 1px solid var(--primary-color)' : '',
                                        ]"
                                        class="group flex items-start dark:hover:bg-light-50 dark:hover:bg-opacity-10 hover:bg-gray-600 hover:bg-opacity-10 px-8px py-2 relative transition-colors duration-150 cursor-pointer"
                                        @mousedown="handleVerseMouseDown($event, verse.verse)"
                                    >
                                        <div
                                            v-if="!verse.version[paneIndex].missing"
                                            class="w-full"
                                            :class="{
                                                'context-menu-active-verse':
                                                    contextMenuVerseKey === verse.version[paneIndex].key,
                                            }"
                                            @contextmenu.prevent="clickContextMenu({ ...verse, key: verse.version[paneIndex].key, text: verse.version[paneIndex].text, bibleVersion: verse.version[paneIndex].version }, paneIndex)"
                                        >
                                            <div :style="`font-size:${fontSize}px`">
                                                <span
                                                    class="font-bold select-none italic the-verse-number"
                                                >
                                                    {{ verse.verse }}.
                                                </span>
                                                <!-- TTS play/indicator -->
                                                <Icon
                                                    v-if="
                                                        activeStore().activeVerseNumber === verse.verse &&
                                                        paneIndex === activeStore().selectedVersionIndex
                                                    "
                                                    icon="mdi:account-voice"
                                                    :style="`font-size: ${fontSize}px; vertical-align: middle;`"
                                                    class="text-[var(--primary-color)] animate-pulse mx-5px"
                                                    title="Reading this verse"
                                                />
                                                <NButton
                                                    v-else-if="
                                                        activeStore().activeVerseNumber !== verse.verse
                                                    "
                                                    size="tiny"
                                                    quaternary
                                                    circle
                                                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style="vertical-align: middle; margin: 0 1px"
                                                    title="Read from this verse"
                                                    @click.stop="
                                                        playVerse(verseIndex, paneIndex)
                                                    "
                                                >
                                                    <Icon
                                                        icon="mdi:play"
                                                        :style="`font-size: ${fontSize - 3}px;`"
                                                    />
                                                </NButton>
                                                <span
                                                    :data-bible-version="verse.version[paneIndex].version"
                                                    :data-book="verse.book_number"
                                                    :data-chapter="verse.chapter"
                                                    :data-key="verse.version[paneIndex].key"
                                                    :data-verse="verse.verse"
                                                    class="verse-select-text input-text-search"
                                                    v-html="settingStore.showStrongsNumbers ? wrapStrongsWords(verse.version[paneIndex].text) : verse.version[paneIndex].text"
                                                    @mouseover="handleFootnoteHover($event, verse.version[paneIndex], verse)"
                                                    @mouseleave="footnotePopover.show = false"
                                                    @mousedown="handleStrongsMouseDown($event, verse)"
                                                    @click="handleStrongsClick"
                                                ></span>
                                                <NIcon
                                                    v-if="bookmarkStore.isBookmarkExists(`${verse.book_number}_${verse.chapter}_${verse.verse}`)"
                                                    size="16"
                                                    class="text-[var(--primary-color)] ml-4px"
                                                    style="vertical-align: middle; display: inline-flex;"
                                                    title="Bookmarked"
                                                >
                                                    <BookmarkFilled />
                                                </NIcon>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Clip notes -->
                                    <div
                                        v-if="
                                            clipNoteRender(
                                                `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                            )
                                        "
                                        :style="`background: ${
                                            clipNoteRender(
                                                `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                            ).color
                                        }`"
                                        class="prose-mirror-render-html relative text-dark-900 rounded-b-md mb-3"
                                    >
                                        <NIcon
                                            class="absolute -top-16px left-1 transform rotate-45 dark:text-gray-600"
                                            size="30"
                                        >
                                            <Attachment />
                                        </NIcon>
                                        <div class="absolute flex gap-2 -top-5 right-3">
                                            <NButton
                                                class="shadow-md"
                                                :style="`background: ${
                                                    clipNoteRender(
                                                        `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                                    ).color
                                                }`"
                                                size="small"
                                                @click="
                                                    createClipNoteRef &&
                                                    createClipNoteRef.toggleClipNoteModal(
                                                        clipNoteRender(
                                                            `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                                        ),
                                                    )
                                                "
                                                title="Edit"
                                            >
                                                <NIcon class="text-dark-9">
                                                    <Edit />
                                                </NIcon>
                                            </NButton>
                                            <NButton
                                                class="shadow-md"
                                                :style="`background: ${
                                                    clipNoteRender(
                                                        `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                                    ).color
                                                }`"
                                                size="small"
                                                @click="
                                                    deleteClipNote({
                                                        book_number: verse.book_number,
                                                        chapter: verse.chapter,
                                                        verse: verse.verse,
                                                    })
                                                "
                                                title="Delete"
                                            >
                                                <NIcon class="text-dark-9">
                                                    <Delete />
                                                </NIcon>
                                            </NButton>
                                        </div>
                                        <div
                                            :style="`font-size:${fontSize - 1}px`"
                                            class="px-10px pb-1 view-verse-rendered-clip-note"
                                            v-html="
                                                clipNoteRender(
                                                    `${verse.book_number}_${verse.chapter}_${verse.verse}`,
                                                ).content
                                            "
                                        ></div>
                                    </div>
                                </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </Pane>
            </Splitpanes>
        </div>
        <Transition name="verse-sel-badge">
            <div
                v-if="selectedVerseNumbers.length > 0"
                class="fixed bottom-24px left-50% z-50 flex items-center gap-8px px-14px py-6px rounded-full shadow-lg select-none"
                style="transform: translateX(-50%); background: var(--primary-color); color: #fff;"
            >
                <span class="text-sm font-medium">
                    {{ selectedVerseNumbers.length }} verse{{ selectedVerseNumbers.length > 1 ? 's' : '' }} selected
                </span>
                <button
                    type="button"
                    class="verse-sel-clear flex items-center justify-center w-18px h-18px p-0 rounded-full border-0 bg-white/20 hover:bg-white/35 text-white cursor-pointer transition-colors"
                    title="Clear selection (Esc)"
                    @mousedown.stop
                    @click="clearVerseSelection"
                >
                    <NIcon size="12"><Close /></NIcon>
                </button>
            </div>
        </Transition>
        <ContextMenu
            :data="contextMenuData"
            :show-context-menu="showContextMenu"
            :x="contextMenuPositionX"
            :y="contextMenuPositionY"
            :selected-verses-data="contextMenuSelectedVerses"
            @close="showContextMenu = false"
            @create-clip-note="handleCreateClipNote"
        />
        <BibleVersionPickerModal
            v-model:show="versionPickerOpen"
            :pane-index="versionPickerPane"
            @select="onVersionPicked"
        />
        <CreateClipNoteVue ref="createClipNoteRef" />
        <PiperModelsModal v-model:show="showPiperModels" />
        <FootnotePopover
            :show="footnotePopover.show"
            :x="footnotePopover.x"
            :y="footnotePopover.y"
            :marker="footnotePopover.marker"
            :text="footnotePopover.text"
            :font-size="fontSize"
        />
        <StrongsPopover
            :show="strongsPopover.show"
            :x="strongsPopover.x"
            :y="strongsPopover.y"
            :below="strongsPopover.below"
            :loading="strongsPopover.loading"
            :entry="strongsPopover.entry"
            :max-height="strongsPopover.maxHeight"
            :font-size="fontSize"
        />
    </div>
</template>
<style lang="scss" src="./ViewVersesStyle.scss"></style>
