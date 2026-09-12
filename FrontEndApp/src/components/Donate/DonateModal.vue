<script lang="ts" setup>
import { NButton, NIcon, NModal } from 'naive-ui';
import { Heart24Filled } from '@vicons/fluent';
import { computed } from 'vue';
import { useMainStore } from '../../store/main';

// Global "support the web app" dialog (mounted once in App.vue, opened from the
// Donate button in the title bar). Links out to the existing donation pages —
// the same ones listed in the Help menu.
const mainStore = useMainStore();

const open = computed({
    get: () => mainStore.showDonateModal,
    set: (v: boolean) => (mainStore.showDonateModal = v),
});

function openExternal(url: string) {
    window.browserWindow.openExternal(url);
}
</script>

<template>
    <NModal
        v-model:show="open"
        preset="card"
        :bordered="false"
        :auto-focus="false"
        style="max-width: 480px; width: 92vw"
    >
        <template #header>
            <div class="donate__header">
                <NIcon size="22" class="donate__heart">
                    <Heart24Filled />
                </NIcon>
                <span>Help Keep Believers Sword Free</span>
            </div>
        </template>

        <div class="donate">
            <p class="donate__lead">
                Believers Sword is free to use — and with your help it stays that way. No paywall,
                no ads, no one turned away from the Word.
            </p>
            <p class="donate__body">
                Your gift quietly carries the cost of the servers, the Bible data, and the hours of
                building, so that the next person who opens this page — wherever they are, whatever
                they can afford — can read, study, and grow freely too.
            </p>

            <blockquote class="donate__verse">
                “Freely ye have received, freely give.”
                <span class="donate__verse-ref">— Matthew 10:8</span>
            </blockquote>

            <p class="donate__close">
                Give if you are able; pray for us either way. Thank you, and God bless you. 🙏
            </p>
        </div>

        <template #footer>
            <div class="donate__footer">
                <NButton quaternary @click="open = false">Maybe later</NButton>
                <div class="donate__actions">
                    <NButton secondary @click="openExternal('https://github.com/sponsors/JenuelDev')">
                        GitHub Sponsors
                    </NButton>
                    <NButton type="primary" @click="openExternal('https://buymeacoffee.com/jenuel.dev')">
                        ☕&nbsp; Buy Me a Coffee
                    </NButton>
                </div>
            </div>
        </template>
    </NModal>
</template>

<style scoped>
.donate__header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
}
.donate__heart {
    color: #e05a6a;
}
.donate {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.donate__lead {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
}
.donate__body {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    opacity: 0.8;
}
.donate__verse {
    margin: 2px 0;
    padding: 10px 14px;
    border-left: 3px solid rgba(224, 90, 106, 0.6);
    border-radius: 6px;
    background: rgba(224, 90, 106, 0.08);
    font-size: 13px;
    font-style: italic;
    line-height: 1.5;
}
.donate__verse-ref {
    display: block;
    margin-top: 4px;
    font-style: normal;
    font-size: 12px;
    opacity: 0.75;
}
.donate__close {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
}
.donate__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
}
.donate__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
