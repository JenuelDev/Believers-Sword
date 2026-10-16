import path from 'node:path';

export const INFOGRAPHICS_VERSION = '2026-10-16';
export const INFOGRAPHICS_ZIP_URL = 'https://github.com/JenuelDev/Believers-Sword/raw/refs/heads/main/contents/grow/wesleyhuff.com%20infographics/wesleyhuff.com.infographics%202026-10-16.zip';
export const RESOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);

export interface InfographicResource {
    title: string;
    category: string;
    fileName: string;
    size: number;
    isPdf: boolean;
    url: string;
}

export function validateResourcePath(name: string): void {
    if (!name || name.includes('\\') || name.includes(':') || name.includes('\0') ||
        path.posix.isAbsolute(name) || name.split('/').some(part => part === '..' || part === '.')) {
        throw new Error('The archive contains an unsafe path.');
    }
}

export function resourceMetadata(name: string, size: number): InfographicResource {
    validateResourcePath(name);
    const parts = name.split('/');
    return {
        title: path.posix.basename(name, path.posix.extname(name)).replace(/\+/g, ' '),
        category: parts.length > 1 ? parts[0] : 'Infographics',
        fileName: name,
        size,
        isPdf: path.posix.extname(name).toLowerCase() === '.pdf',
        url: `infographics://collection/${parts.map(encodeURIComponent).join('/')}`,
    };
}

export function collectionDirectory(userData: string): string {
    return path.join(userData, 'Grow', 'wesley-infographics', INFOGRAPHICS_VERSION);
}
