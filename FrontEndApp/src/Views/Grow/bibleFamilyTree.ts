// Bundled in FrontEndApp/public so it is available offline on install.
export const bibleFamilyTreeNote = 'Based on our own research. The sources and references are listed on the last page.';

/** Packaged Electron loads the page over file://, which fetch() cannot read, so it goes through the app protocol. */
export function bibleFamilyTreeUrl(protocol = window.location.protocol, base = import.meta.env.BASE_URL): string {
    return protocol === 'file:'
        ? 'infographics://bundled/bible-family-tree.pdf'
        : `${base.endsWith('/') ? base : `${base}/`}content/bible-family-tree/Bible_Family_Tree.pdf`;
}
