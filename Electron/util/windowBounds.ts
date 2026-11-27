import type { Rectangle } from 'electron';

export const WINDOW_MIN_WIDTH = 1226;
export const WINDOW_MIN_HEIGHT = 700;

export interface WindowState extends Rectangle {
    isMaximized: boolean;
    isFullScreen: boolean;
    displayId?: number;
    displayBounds?: Rectangle;
    displayWorkArea?: Rectangle;
}

export function isRectangle(value: unknown): value is Rectangle {
    if (!value || typeof value !== 'object') return false;
    const rect = value as Rectangle;
    return [rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) &&
        rect.width > 0 && rect.height > 0;
}

/** Keep normal bounds reachable, translating their offset if a display moved. */
export function fitWindowBounds(bounds: Rectangle, area: Rectangle, previousArea?: Rectangle): Rectangle {
    const width = Math.min(Math.max(bounds.width, WINDOW_MIN_WIDTH), area.width);
    const height = Math.min(Math.max(bounds.height, WINDOW_MIN_HEIGHT), area.height);
    const x = previousArea ? area.x + bounds.x - previousArea.x : bounds.x;
    const y = previousArea ? area.y + bounds.y - previousArea.y : bounds.y;
    return {
        x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
        y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
        width,
        height,
    };
}
