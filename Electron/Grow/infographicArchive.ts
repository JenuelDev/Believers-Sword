import fs from 'node:fs/promises';
import path from 'node:path';
import extract from 'extract-zip';
import { InfographicResource, resourceMetadata, RESOURCE_EXTENSIONS, validateResourcePath } from './infographicPaths';

export async function extractInfographics(zip: string, destination: string): Promise<InfographicResource[]> {
    const stage = `${destination}.extracting`;
    // Both locations are fixed children of this feature's userData directory.
    await fs.rm(stage, { recursive: true, force: true });
    await fs.mkdir(stage, { recursive: true });
    try {
        let expanded = 0;
        let count = 0;
        const seen = new Set<string>();
        await extract(zip, {
            dir: stage,
            onEntry: entry => {
                validateResourcePath(entry.fileName);
                if ((entry.externalFileAttributes >>> 16 & 0xf000) === 0xa000) {
                    throw new Error('Archive links are not supported.');
                }
                expanded += entry.uncompressedSize;
                if (++count > 1000 || entry.uncompressedSize > 64 * 1024 * 1024 || expanded > 512 * 1024 * 1024) {
                    throw new Error('The archive exceeds the supported size.');
                }
                const key = entry.fileName.toLowerCase();
                if (seen.has(key)) throw new Error('The archive contains duplicate paths.');
                seen.add(key);
            },
        });
        const resources: InfographicResource[] = [];
        async function visit(directory: string): Promise<void> {
            for (const item of await fs.readdir(directory, { withFileTypes: true })) {
                const full = path.join(directory, item.name);
                if (item.isSymbolicLink()) throw new Error('Archive links are not supported.');
                if (item.isDirectory()) await visit(full);
                else if (item.isFile() && RESOURCE_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
                    const stat = await fs.stat(full);
                    if (!stat.size) throw new Error('The archive contains an empty resource.');
                    resources.push(resourceMetadata(path.relative(stage, full).split(path.sep).join('/'), stat.size));
                }
            }
        }
        await visit(stage);
        if (!resources.length) throw new Error('The archive contains no images or PDFs.');
        resources.sort((a, b) => `${a.category}/${a.title}`.localeCompare(`${b.category}/${b.title}`));
        await fs.writeFile(path.join(stage, 'catalog.json'), JSON.stringify(resources));
        await fs.rm(destination, { recursive: true, force: true });
        await fs.rename(stage, destination);
        return resources;
    } finally {
        await fs.rm(stage, { recursive: true, force: true });
    }
}
