import { ref } from 'vue';

export function useVerseFootnotes() {
    const footnotePopover = ref({
        show: false,
        x: 0,
        y: 0,
        marker: '',
        text: '',
    });

    async function handleFootnoteHover(event: MouseEvent, version: any, verse: any) {
        const target = event.target as HTMLElement;
        const footnoteEl =
            target.tagName.toLowerCase() === 'f'
                ? target
                : (target.closest?.('f') as HTMLElement | null);

        if (!footnoteEl) {
            footnotePopover.value.show = false;
            return;
        }

        const marker = footnoteEl.textContent?.trim() ?? '';
        if (!marker) return;

        const footnotes: Array<{ marker: string; text: string }> = await (
            window as any
        ).browserWindow.getCommentaryForVerse(
            JSON.stringify({
                version: version.version,
                book_number: verse.book_number,
                chapter: verse.chapter,
                verse: verse.verse,
            }),
        );

        const match = footnotes.find((f) => f.marker === marker);
        if (!match) return;

        const rect = footnoteEl.getBoundingClientRect();
        footnotePopover.value = {
            show: true,
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            marker,
            text: match.text,
        };
    }


    return { footnotePopover, handleFootnoteHover };
}
