<script lang="ts" setup>
import { NButton, NIcon } from 'naive-ui';
import { Heart24Filled } from '@vicons/fluent';
import { useMainStore } from '../../../store/main';

// Web-only: the desktop build already surfaces donation links in the Help menu
// and its own donate window, so this sits in the title bar of the web app.
const mainStore = useMainStore();
const isElectron = window.isElectron;
</script>

<template>
    <NButton
        v-if="!isElectron"
        round
        size="small"
        quaternary
        class="donate-button"
        :title="$t('Donate')"
        @click="mainStore.showDonateModal = true"
    >
        <template #icon>
            <NIcon size="18">
                <Heart24Filled />
            </NIcon>
        </template>
        {{ $t('Donate') }}
    </NButton>
</template>

<style scoped>
.donate-button {
    color: #e05a6a;
}
</style>
