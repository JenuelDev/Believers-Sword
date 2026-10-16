<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePanZoom } from './usePanZoom';
import { rotatedImageLayout } from './viewRotation';

const props = defineProps<{ url: string; title: string; zoom: number; rotation: number }>();
const emit = defineEmits<{ (event: 'update:zoom', value: number): void }>();
const viewport = ref<HTMLDivElement>();
const stage = ref<HTMLDivElement>();
const naturalWidth = ref(1);
const naturalHeight = ref(1);
const availableWidth = ref(1);
const error = ref(false);
const zoom = computed({ get: () => props.zoom, set: value => emit('update:zoom', value) });
const panZoom = usePanZoom(viewport, stage, zoom, { min: 0.25, max: 4 });
const layout = computed(() => rotatedImageLayout(naturalWidth.value, naturalHeight.value,
    availableWidth.value, props.zoom, props.rotation));
let observer: ResizeObserver | undefined;

function measure() {
    if (viewport.value) availableWidth.value = Math.max(1, viewport.value.clientWidth - 24);
}
function loaded(event: Event) {
    const image = event.target as HTMLImageElement;
    naturalWidth.value = image.naturalWidth;
    naturalHeight.value = image.naturalHeight;
    measure();
}
onMounted(() => {
    measure();
    observer = new ResizeObserver(measure);
    if (viewport.value) observer.observe(viewport.value);
});
watch(() => props.rotation, async () => {
    await nextTick();
    viewport.value?.scrollTo({ left: 0, top: 0, behavior: 'instant' });
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <div ref="viewport" class="image-viewport" :style="{ cursor: panZoom.cursor.value }"
        @wheel="panZoom.onWheel" @mousedown="panZoom.onMouseDown">
        <p v-if="error" role="alert">This image could not be opened. Please download the collection again.</p>
        <div v-else ref="stage" class="image-stage" :style="{ width: `${layout.stageWidth}px`, height: `${layout.stageHeight}px` }">
            <img :src="url" :alt="title" draggable="false" class="rotatable-image"
                :style="{ width: `${layout.width}px`, height: `${layout.height}px`, transform: `translate(${layout.offsetX}px, ${layout.offsetY}px) rotate(${layout.angle}deg)` }"
                @load="loaded" @error="error = true" />
        </div>
    </div>
</template>

<style scoped>
.image-viewport { flex: 1; min-height: 0; overflow: auto; padding: 12px; scroll-behavior: auto; }
.image-stage { position: relative; overflow: hidden; }
.rotatable-image { position: absolute; left: 0; top: 0; max-width: none; transform-origin: 0 0; user-select: none; }
</style>
