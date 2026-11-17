/** Pick the higher-contrast foreground for a solid primary accent. */
export function getPrimaryForeground(color: string): '#000000' | '#ffffff' {
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return '#ffffff';
    const channels = [1, 3, 5].map((start) => {
        const value = parseInt(color.slice(start, start + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const darkContrast = (luminance + 0.05) / 0.05;
    const lightContrast = 1.05 / (luminance + 0.05);
    return darkContrast > lightContrast ? '#000000' : '#ffffff';
}
