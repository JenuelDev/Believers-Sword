/** Routes that Electron opens in their own frameless window, without the app shell. */
export const POPUP_ROUTE_PATHS = ['/compare-verse', '/bible-question'];

/**
 * True when the window started on a popup route. The router's first navigation
 * resolves after the app mounts (and popup views may be lazy), so App.vue reads
 * the start URL directly; otherwise a popup would first mount the whole main
 * layout — Bible reader, verse loads and all — before switching.
 */
export function isPopupHash(hash: string): boolean {
    const path = hash.replace(/^#/, '').split('?')[0];
    return POPUP_ROUTE_PATHS.includes(path);
}
