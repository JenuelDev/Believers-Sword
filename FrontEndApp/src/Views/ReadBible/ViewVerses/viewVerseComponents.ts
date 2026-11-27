import { Transition } from 'vue';
import { NButton, NIcon, NSelect, NSlider } from 'naive-ui';
import { Attachment, BookmarkFilled, Delete, Edit, Close } from '@vicons/carbon';
import { Icon } from '@iconify/vue';
import { Splitpanes, Pane } from 'splitpanes';
import ContextMenu from './ContextMenu/ContextMenu.vue';
import BibleVersionPickerModal from './BibleVersionPickerModal.vue';
import CreateClipNoteVue from '../../../components/ClipNotes/CreateClipNote.vue';
import VerseSelector from '../../../components/VerseSelector.vue';
import PiperModelsModal from '../../../components/Settings/VerseReader/PiperModelsModal.vue';
import FootnotePopover from '../../../components/FootnotePopover/FootnotePopover.vue';
import StrongsPopover from '../../../components/StrongsPopover/StrongsPopover.vue';

export const viewVerseComponents = {
    Attachment, BibleVersionPickerModal, BookmarkFilled, Close, ContextMenu,
    CreateClipNoteVue, Delete, Edit, FootnotePopover, Icon, NButton, NIcon,
    NSelect, NSlider, Pane, PiperModelsModal, Splitpanes, StrongsPopover, Transition,
    VerseSelector,
};
