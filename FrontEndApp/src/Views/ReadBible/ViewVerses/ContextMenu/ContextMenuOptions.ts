import type { Component } from 'vue';
import { BookmarkAdd, Attachment, Copy } from '@vicons/carbon';
import {
    EraserSegment24Filled,
    TabDesktopMultiple20Regular,
    PaintBrush24Regular,
} from '@vicons/fluent';

interface ContextMenuOption {
    label: string;
    description?: string;
    icon: Component;
    key: string;
    /** Accent colour for the icon tile (verse actions). */
    color?: string;
}

/**
 * Primary verse actions, shown as cards with a tinted icon tile + chevron
 * under the "Verse Actions" heading.
 */
export const ContextMenuOptions: ContextMenuOption[] = [
    {
        label: 'Copy Verse',
        icon: Copy,
        key: 'copy-verse',
        color: '#06b6d4',
    },
    {
        label: 'Add to Bookmark',
        icon: BookmarkAdd,
        key: 'add-to-bookmark',
        color: '#8b5cf6',
    },
    {
        label: 'Create Clip Note',
        icon: Attachment,
        key: 'create-clip-note',
        color: '#3b82f6',
    },
    {
        label: 'Highlight Verse',
        icon: PaintBrush24Regular,
        key: 'highlight-verse',
        color: '#eab308',
    },
    {
        label: 'Compare Verse',
        icon: TabDesktopMultiple20Regular,
        key: 'compare-verse',
        color: '#10b981',
    },
];

/**
 * Destructive action, separated at the bottom of the menu.
 */
export const ClearHighlightOption: ContextMenuOption = {
    label: 'Clear Highlight',
    description: 'Remove highlight from this verse',
    icon: EraserSegment24Filled,
    key: 'clear-highlight',
    color: '#ef4444',
};
