export function playSound(url: string) {
    try {
        const audio = new Audio(url);
        void audio.play();
    } catch (_) {
        /* best effort — never let a sound failure break gameplay */
    }
}

