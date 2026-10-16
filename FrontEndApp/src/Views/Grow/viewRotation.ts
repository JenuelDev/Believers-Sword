export function rotateView(current: number, degrees: number): number {
    return ((current + degrees) % 360 + 360) % 360;
}

/** Positive layout bounds keep every corner reachable after a quarter turn. */
export function rotatedImageLayout(naturalWidth: number, naturalHeight: number,
    viewportWidth: number, zoom: number, rotation: number) {
    const angle = rotateView(rotation, 0);
    const sideways = angle === 90 || angle === 270;
    const scale = viewportWidth * zoom / (sideways ? naturalHeight : naturalWidth);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const stageWidth = sideways ? height : width;
    const stageHeight = sideways ? width : height;
    const offsetX = angle === 90 || angle === 180 ? stageWidth : 0;
    const offsetY = angle === 180 || angle === 270 ? stageHeight : 0;
    return { width, height, stageWidth, stageHeight, offsetX, offsetY, angle };
}
