import { createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../store/authStore';
import PrayerList from './../Views/PrayerList/PrayerList.vue';
import AboutPage from './../Views/About/About.vue';
import HelpPortal from './../Views/HelpPortal/HelpPortal.vue';
import LoginPage from './../Views/UserProfile/Pages/Login.vue';
import ProfileAccountPage from './../Views/UserProfile/Pages/Profile/Profile.vue';
import UserProfileLayout from './../Views/UserProfile/Profile.vue';
import CompareVerse from '../Views/CompareVerse/CompareVerse.vue';
import DailyDevotional from '../Views/DailyDevotional/DailyDevotional.vue';

export const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        redirect: 'prayer-list',
    },
    {
        name: 'Login',
        path: '/login',
        component: LoginPage,
        meta: { public: true },
    },
    {
        name: 'PrayerList',
        path: '/prayer-list',
        component: PrayerList,
    },
    {
        path: '/profile',
        component: UserProfileLayout,
        children: [
            {
                path: '',
                name: 'ProfilePage',
                redirect: () =>
                    localStorage.getItem('auth_token') ? '/profile/profile' : '/login',
            },
            {
                path: 'profile',
                component: ProfileAccountPage,
            },
        ],
    },
    {
        name: 'AboutPage',
        path: '/about-page',
        component: AboutPage,
    },
    {
        name: 'HelpPortal',
        path: '/help-portal',
        component: HelpPortal,
    },
    {
        name: 'CompareVerse',
        path: '/compare-verse',
        component: CompareVerse,
    },
    {
        name: 'DailyDevotional',
        path: '/daily-devotional',
        component: DailyDevotional,
    },
    {
        // Bible Games — Electron-only (needs bundled game DBs + local progress).
        // Lazy-loaded so the web bundle never pulls it in; the guard redirects
        // any web user who reaches it.
        name: 'Games',
        path: '/games',
        component: () => import('../Views/Games/Games.vue'),
        beforeEnter: () => (window.isElectron ? true : { name: 'PrayerList' }),
    },
];
const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

router.beforeEach(async (to) => {
    // The desktop (Electron) build stores everything locally — no account needed.
    if (window.isElectron) return true;
    if (to.meta?.public) return true;

    // Web is free, but still requires a signed-in account: the browser build has
    // no local database, so the backend IS its storage. Subscription tier is not
    // checked here — Sync (carrying this data to phone/desktop) is the paid
    // feature, not web access itself.
    if (!localStorage.getItem('auth_token')) return { name: 'Login' };

    // Ensure the session is resolved (the guard can run before App.vue's initAuth
    // on a hard reload) so a rejected token lands on Login rather than a blank app.
    const auth = useAuthStore();
    await auth.ensureSession();
    if (!auth.token) return { name: 'Login' }; // token rejected (401) while loading

    return true;
});

export default router;
