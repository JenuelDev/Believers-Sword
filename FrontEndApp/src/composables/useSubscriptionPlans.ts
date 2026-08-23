import { computed } from 'vue';
import { useWebBillingStore, type PlanOption } from '../store/webBillingStore';

/** A plan column rendered in the Choose-your-plan / Manage / gate UIs. */
export interface PlanCard {
    key: 'sync';
    name: string;
    tagline: string;
    /** Display price — the live store price when available, else the fallback. */
    price: string;
    /** The purchasable package, or undefined when offerings aren't loaded. */
    plan: PlanOption | undefined;
    highlight: boolean;
    badge: string;
    features: string[];
}

// Shown when live offerings aren't available (web checkout disabled / no web
// key). These mirror the mobile store prices so the cards always show a price.
const FALLBACK_SYNC_PRICE = '$1.99';

const SYNC_FEATURES = [
    'Cross-device sync — notes, highlights, bookmarks, prayer lists & more',
    'Cloud backup of your study data',
    'Web app access',
    'No ads',
];

/**
 * Single source of truth for the subscription plan cards (names, taglines,
 * features and prices). Prices prefer the live RevenueCat offering and fall
 * back to the known store prices, so a price always shows even when web billing
 * isn't configured. Used by PlanModal, the Manage-plan modal and the web gate.
 */
export function useSubscriptionPlans() {
    const webBilling = useWebBillingStore();

    const syncPlan = computed(
        () =>
            webBilling.plans.find((p) => p.id === 'sync_monthly') ??
            webBilling.plans.find(
                (p) =>
                    p.title.toLowerCase().includes('sync') &&
                    !p.title.toLowerCase().includes('pro'),
            ),
    );
    const syncPrice = computed(() => syncPlan.value?.price || FALLBACK_SYNC_PRICE);

    const planCards = computed<PlanCard[]>(() => [
        {
            key: 'sync',
            name: 'Sync',
            tagline: 'Sync & back up your study',
            price: syncPrice.value,
            plan: syncPlan.value,
            highlight: true,
            badge: '',
            features: SYNC_FEATURES,
        },
    ]);

    return { planCards, syncPlan, syncPrice };
}
