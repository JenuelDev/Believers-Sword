<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton } from 'naive-ui';
import { Icon } from '@iconify/vue';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { usePanZoom } from './usePanZoom';
import { rotateView } from './viewRotation';

const props = defineProps<{ url: string }>();
const canvas = ref<HTMLCanvasElement>();
const viewport = ref<HTMLDivElement>();
const page = ref(1);
const total = ref(0);
const zoom = ref(1);
const rotation = ref(0);
const loading = ref(true);
const error = ref('');
const panZoom = usePanZoom(viewport, canvas, zoom, { min: 0.5, max: 3 });
let document: PDFDocumentProxy | undefined;
let renderTask: RenderTask | undefined;
let generation = 0;
let disposed = false;
let observer: ResizeObserver | undefined;

async function render() {
    const current = ++generation;
    if (renderTask) {
        renderTask.cancel();
        await renderTask.promise.catch(() => {});
    }
    if (disposed || current !== generation) return;
    if (!document || !canvas.value || !viewport.value) return;
    try {
        const pdfPage = await document.getPage(page.value);
        if (disposed || current !== generation) return;
        const pageRotation = rotateView(pdfPage.rotate, rotation.value);
        const original = pdfPage.getViewport({ scale: 1, rotation: pageRotation });
        const cssScale = Math.max(0.1, (viewport.value.clientWidth - 32) / original.width) * zoom.value;
        // Keep GPU/canvas memory bounded while keeping text sharp on dense screens.
        const width = original.width * cssScale;
        const height = original.height * cssScale;
        const density = Math.min(window.devicePixelRatio || 1, 4096 / width, 8192 / height,
            Math.sqrt(16 * 1024 * 1024 / (width * height)));
        const renderViewport = pdfPage.getViewport({ scale: cssScale * density, rotation: pageRotation });
        const element = canvas.value;
        element.width = Math.ceil(renderViewport.width);
        element.height = Math.ceil(renderViewport.height);
        element.style.width = `${original.width * cssScale}px`;
        element.style.height = `${original.height * cssScale}px`;
        renderTask = pdfPage.render({ canvasContext: element.getContext('2d')!, viewport: renderViewport });
        await renderTask.promise;
        if (current === generation) error.value = '';
    } catch (failure) {
        if (current === generation && (failure as Error).name !== 'RenderingCancelledException') {
            error.value = 'Could not render this PDF. Please reopen it or download the collection again.';
        }
    }
}

onMounted(async () => {
    try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const response = await fetch(props.url);
        if (!response.ok) throw new Error('Could not read PDF');
        document = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
        if (disposed) { await document.destroy(); return; }
        total.value = document.numPages;
        await render();
        observer = new ResizeObserver(() => { void render(); });
        if (viewport.value) observer.observe(viewport.value);
    } catch {
        if (!disposed) error.value = 'Could not open this PDF. Please download the collection again.';
    } finally {
        if (!disposed) loading.value = false;
    }
});
watch([page, zoom, rotation], () => { void render(); });
watch(rotation, () => viewport.value?.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
onBeforeUnmount(() => {
    disposed = true;
    generation++;
    observer?.disconnect();
    renderTask?.cancel();
    void document?.destroy();
});
</script>

<template>
    <div class="flex flex-col flex-1 min-h-0">
        <div class="flex items-center justify-center gap-3 p-2 flex-wrap">
            <NButton size="small" aria-label="Rotate left 90 degrees" title="Rotate left 90°" @click="rotation = rotateView(rotation, -90)"><Icon icon="mdi:rotate-left" /></NButton>
            <NButton size="small" aria-label="Rotate right 90 degrees" title="Rotate right 90°" @click="rotation = rotateView(rotation, 90)"><Icon icon="mdi:rotate-right" /></NButton>
            <NButton size="small" :disabled="page <= 1" @click="page--">Previous</NButton>
            <span class="text-sm">Page {{ page }} of {{ total }}</span>
            <NButton size="small" :disabled="page >= total" @click="page++">Next</NButton>
            <NButton size="small" :disabled="zoom <= 0.5" aria-label="Zoom out" @click="zoom = Math.max(0.5, zoom - 0.25)">−</NButton>
            <NButton size="small" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</NButton>
            <NButton size="small" :disabled="zoom >= 3" aria-label="Zoom in" @click="zoom = Math.min(3, zoom + 0.25)">+</NButton>
        </div>
        <div ref="viewport" class="flex-1 min-h-0 overflow-auto p-4" :style="{ cursor: panZoom.cursor.value, scrollBehavior: 'auto' }"
            @wheel="panZoom.onWheel" @mousedown="panZoom.onMouseDown">
            <p v-if="loading" role="status">Opening PDF...</p>
            <p v-if="error" role="alert">{{ error }}</p>
            <canvas ref="canvas" aria-label="PDF page" class="block mx-auto" />
        </div>
    </div>
</template>
