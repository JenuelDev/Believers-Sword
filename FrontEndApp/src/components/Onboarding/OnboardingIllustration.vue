<script setup lang="ts">
defineProps<{ step: string; desktop: boolean }>();
</script>

<template>
    <div class="tour-preview" aria-hidden="true">
        <div class="preview-bar"><span class="preview-dot" /> Believers Sword <span class="preview-status">Your study space</span></div>
        <div v-if="step === 'compare'" class="preview-panels">
            <div v-for="version in ['KJV', 'ASV', 'NASB']" :key="version" class="preview-card">
                <div class="preview-label">{{ version }}</div><strong>John 1:1</strong>
                <p>In the beginning was the Word...</p><div class="preview-line" /><div class="preview-line short" />
            </div>
        </div>
        <div v-else-if="step === 'references'" class="preview-stack">
            <div class="preview-label">CROSS REFERENCES · JOHN 1:1</div>
            <div class="preview-card"><strong>Genesis 1:1</strong><p>In the beginning God created the heaven and the earth.</p></div>
            <div class="preview-card"><strong>John 1:14</strong><p>And the Word was made flesh, and dwelt among us...</p></div>
        </div>
        <div v-else-if="step === 'listen'" class="preview-stack">
            <div class="preview-label">VERSE READER</div>
            <div class="preview-card"><strong>Psalm 23:1</strong><p>The LORD is my shepherd; I shall not want.</p></div>
            <div class="preview-player"><span class="preview-play">▶</span><div><strong>Listen to Scripture</strong><div class="preview-line" /></div><span>1×</span></div>
        </div>
        <div v-else-if="step === 'appearance'" class="preview-panels">
            <div class="preview-card sample-light"><div class="preview-label">LIGHT</div><strong>Aa</strong><p>A comfortable place to read.</p></div>
            <div class="preview-card sample-dark"><div class="preview-label">DARK</div><strong>Aa</strong><p>A comfortable place to read.</p></div>
        </div>
        <div v-else-if="step === 'versions'" class="preview-stack">
            <div class="preview-label">{{ desktop ? 'YOUR OFFLINE LIBRARY' : 'ONLINE BIBLE CATALOG' }}</div>
            <div class="preview-card library-row"><strong>King James Version</strong><span class="preview-chip">{{ desktop ? 'On device' : 'Online' }}</span></div>
            <div class="preview-card library-row"><strong>American Standard Version</strong><span class="preview-chip">{{ desktop ? 'On device' : 'Online' }}</span></div>
            <div class="preview-label">Optional books · Your choice</div>
        </div>
        <div v-else-if="step === 'growth'" class="preview-stack">
            <div class="preview-label">A LITTLE TIME, EVERY DAY</div>
            <div class="preview-card"><strong>Daily Devotional</strong><p>Read. Reflect. Pray.</p></div>
            <div class="preview-chips"><span class="preview-chip">Prayer list</span><span class="preview-chip">Grow</span><span v-if="desktop" class="preview-chip">Bible games</span></div>
        </div>
        <div v-else class="preview-stack">
            <div class="preview-label">PSALM 119:105</div>
            <div class="preview-card"><p class="sample-verse" :class="{ highlighted: step === 'study' }">Thy word is a lamp unto my feet, and a light unto my path.</p></div>
            <div v-if="step === 'study'" class="preview-chips"><span class="preview-chip">Bookmark</span><span class="preview-chip">Highlight</span><span class="preview-chip">Clip note</span></div>
            <div v-else class="preview-line short" />
        </div>
    </div>
</template>

<style scoped>
.tour-preview { border: 1px solid var(--tour-border); background: var(--tour-soft); border-radius: 16px; overflow: hidden; }
.preview-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 12px; border-bottom: 1px solid var(--tour-border); }
.preview-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tour-accent); }
.preview-status { margin-left: auto; opacity: .65; font-size: 10px; }
.preview-stack { display: grid; gap: 10px; padding: 18px; }
.preview-label { font-size: 10px; letter-spacing: .08em; font-weight: 700; color: var(--tour-accent); }
.preview-card { padding: 14px; border: 1px solid var(--tour-border); border-radius: 10px; background: var(--tour-card); }
.preview-card p { margin: 6px 0 0; font-family: Georgia, serif; font-size: 15px; line-height: 1.6; }
.preview-card strong { font-size: 13px; }
.preview-card .sample-verse { font-size: 19px; margin: 0; }
.highlighted { background: var(--tour-highlight); border-radius: 4px; }
.preview-panels { display: flex; gap: 8px; padding: 18px; }
.preview-panels .preview-card { flex: 1; min-width: 0; padding: 12px; }
.preview-panels .preview-label { margin-bottom: 8px; }
.preview-line { height: 5px; border-radius: 5px; background: currentColor; opacity: .12; margin-top: 12px; width: 100%; }
.preview-line.short { width: 65%; }
.preview-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.preview-chip { color: var(--tour-accent); background: var(--tour-tint); border-radius: 20px; padding: 4px 10px; font-size: 11px; }
.preview-player { display: flex; align-items: center; gap: 15px; padding: 8px; }
.preview-player > div { flex: 1; }
.preview-play { display: grid; place-items: center; border-radius: 50%; width: 38px; height: 38px; color: var(--tour-card); background: var(--tour-accent); }
.sample-light { background: #f7f5ee; color: #27362f; }
.sample-dark { background: #15231f; color: #edf4ef; }
.sample-light strong, .sample-dark strong { font-size: 34px; font-family: Georgia, serif; }
.library-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
@media (max-width: 480px) { .preview-status { display: none; } .preview-panels { gap: 5px; padding: 10px; } .preview-panels .preview-card { padding: 8px; } .preview-panels .preview-card p { font-size: 12px; } }
</style>
