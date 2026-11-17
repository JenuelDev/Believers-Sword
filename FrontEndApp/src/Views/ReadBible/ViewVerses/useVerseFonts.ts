import { ref, watch } from 'vue';
import SESSION from '../../../util/session';

export function useVerseFonts() {
    const fontSizeOfShowChapter = 'font-size-of-show-chapter';
    const fontSize = ref(15);
    const fontSelected = ref('Poppins');
    const bundledFonts = [
        { label: 'Poppins', value: 'Poppins' },
        { label: 'Inter', value: 'Inter' },
        { label: 'Zodiac', value: 'Zodiac' },
    ];
    const fontOptions = ref<any[]>([...bundledFonts]);

    async function loadSystemFonts() {
        try {
            const fonts: any[] = await (window as any).queryLocalFonts();
            const families = [...new Set(fonts.map((f) => f.family as string))].sort();
            const systemFonts = families
                .filter((f) => !bundledFonts.some((b) => b.value === f))
                .map((f) => ({ label: f, value: f }));
            fontOptions.value = [
                { type: 'group', label: 'Bundled', key: 'bundled', children: bundledFonts },
                { type: 'group', label: 'System Fonts', key: 'system', children: systemFonts },
            ];
        } catch {
            // queryLocalFonts not available or permission denied , keep bundled fonts only
        }
    }

    watch(
        () => fontSelected.value,
        (FSelected: string) => {
            SESSION.set('font-family-of-show-chapter', FSelected);
            document.documentElement.style.setProperty('--bible-font-family', FSelected);
        },
    );

    watch(
        () => fontSize.value,
        (FSize: number) => {
            SESSION.set(fontSizeOfShowChapter, FSize);
        },
    );


    return { fontSizeOfShowChapter, fontSize, fontSelected, fontOptions, loadSystemFonts };
}
