import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import { runSync, runPullSync, resetSyncBackoff } from '../util/Sync/sync';
import { createAuthSessionSync } from './auth/authSessionSync';
import { createAuthProfile } from './auth/authProfile';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

export interface UserInfo {
    id?: number;
    user_id?: number;
    denomination: string | null;
    profile_picture?: string | null;
}

export interface User {
    id: number;
    name: string;
    username?: string | null;
    email: string;
    pending_email?: string | null;
    /** Server-verified active services, e.g. ["ai","sync"] (RevenueCat webhook
     *  source of truth). The display tier is derived from this. */
    services?: string[];
    /** ISO-8601 renewal/expiry date of the active subscription, or null. */
    subscription_renews_at?: string | null;
    /** ISO-8601 date a scheduled plan change (e.g. Pro → Sync downgrade) takes
     *  effect, or null when none is pending. */
    subscription_pending_change_at?: string | null;
    email_verified_at?: string;
    created_at?: string;
    updated_at?: string;
    info?: UserInfo | null;
}

export interface AuthTokens {
    token: string;
    refreshToken?: string;
}

export interface UserSettings {
    id?: number;
    selected_theme: string;
    is_dark: boolean;
    background_theme: string;
}

export const useAuthStore = defineStore('authStore', () => {
    const user = ref<User | null>(null);
    const token = ref<string | null>(null);
    const isAuthenticated = ref(false);
    const remoteSettings = ref<UserSettings | null>(null);

    // Server-verified active services (authoritative; the backend also gates
    // every request). The source of truth for entitlement gating.
    const services = computed<string[]>(() => user.value?.services ?? []);
    const hasService = (service: string) => services.value.includes(service);

    // Upload entitlement is independent of authenticated downloads.
    const isSyncEntitled = computed(() => hasService('sync'));

    // Display tier derived from the services, for plan labels/badges/pricing:
    // holds `ai` → Pro, else `sync` → Sync, else Free. Presentation only — all
    // gating uses the services above.
    const tier = computed<'free' | 'sync'>(() =>
        hasService('sync') ? 'sync' : 'free',
    );

    // Local avatar cache — base64 data URL of the last uploaded custom picture.
    // Keyed by the profile_picture value so it auto-invalidates if the picture changes.
    const localAvatarKey  = ref<string | null>(localStorage.getItem('profile_avatar_key'));
    const localAvatarCache = ref<string | null>(localStorage.getItem('profile_avatar_data'));

    // Pending settings that failed to reach the server (e.g. offline).
    // Stored in localStorage so they survive app restarts.
    const pendingSettingsUpdate = ref<Partial<UserSettings> | null>(
        (() => {
            try { return JSON.parse(localStorage.getItem('pending_theme_settings') || 'null'); }
            catch { return null; }
        })()
    );

    // Restore cached user from previous session so profile shows immediately offline.
    (() => {
        const savedUser = localStorage.getItem('cached_user');
        if (savedUser) {
            try { user.value = JSON.parse(savedUser); } catch {}
        }
    })();

    // Auto-persist user on every change so it's available offline on next launch.
    watch(user, (u) => {
        if (u) {
            localStorage.setItem('cached_user', JSON.stringify(u));
        } else {
            localStorage.removeItem('cached_user');
        }
    }, { deep: true });

    /**
     * Register a new user
     */
    async function register(
        name: string,
        username: string,
        email: string,
        password: string,
        passwordConfirmation: string,
        denomination?: string | null
    ): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/register`, {
                name,
                username,
                email,
                password,
                password_confirmation: passwordConfirmation,
                ...(denomination ? { denomination } : {}),
            });

            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: response.data.message,
                };
            }

            return { success: false, message: 'Registration failed' };
        } catch (error: any) {
            console.error('Registration error:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Registration failed',
            };
        }
    }

    /**
     * Login user
     */
    async function login(
        email: string,
        password: string
    ): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, {
                email,
                password,
            });

            if (response.data.status === 'success') {
                user.value = response.data.user;
                token.value = response.data.token;
                isAuthenticated.value = true;

                localStorage.setItem('auth_token', response.data.token);

                // Load remote settings after login (fire-and-forget)
                loadSettings();

                return {
                    success: true,
                    message: response.data.message,
                    user: response.data.user,
                    token: response.data.token,
                };
            }

            return { success: false, message: 'Login failed' };
        } catch (error: any) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Invalid credentials',
            };
        }
    }

    /**
     * Delete the authenticated user's account.
     * Requires email confirmation matching the current user's email.
     */
    async function deleteAccount(email: string): Promise<{ success: boolean; message: string }> {
        const currentToken = token.value;
        if (!currentToken) return { success: false, message: 'Not authenticated' };

        try {
            const response = await axios.delete(`${API_BASE_URL}/auth/account`, {
                headers: { Authorization: `Bearer ${currentToken}` },
                data: { email },
            });

            if (response.data.status === 'success') {
                user.value = null;
                token.value = null;
                isAuthenticated.value = false;
                remoteSettings.value = null;
                pendingSettingsUpdate.value = null;
                localAvatarKey.value   = null;
                localAvatarCache.value = null;
                localStorage.removeItem('auth_token');
                localStorage.removeItem('pending_theme_settings');
                localStorage.removeItem('cached_user');
                localStorage.removeItem('profile_avatar_key');
                localStorage.removeItem('profile_avatar_data');
                return { success: true, message: response.data.message };
            }

            return { success: false, message: response.data.message || 'Failed to delete account' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to delete account',
            };
        }
    }

    /**
     * Logout user
     */
    async function logout(): Promise<{ success: boolean; message: string }> {
        const currentToken = token.value;

        // Always clear local state immediately
        user.value = null;
        token.value = null;
        isAuthenticated.value = false;
        remoteSettings.value = null;
        pendingSettingsUpdate.value = null;
        localAvatarKey.value   = null;
        localAvatarCache.value = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('pending_theme_settings');
        localStorage.removeItem('cached_user');
        localStorage.removeItem('profile_avatar_key');
        localStorage.removeItem('profile_avatar_data');

        if (!currentToken) {
            return { success: false, message: 'No token to logout' };
        }

        try {
            await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
                headers: { Authorization: `Bearer ${currentToken}` },
            });
            return { success: true, message: 'Logged out successfully' };
        } catch (error: any) {
            console.error('Logout error:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Logout failed',
            };
        }
    }

    let getUserPromise: Promise<User | null> | null = null;

    /**
     * Get current user info.
     * Only clears auth state on 401/403 — network errors keep existing state
     * so the user is not logged out when offline.
     */
    function getUser(forceRefresh = false): Promise<User | null> {
        if (!forceRefresh && user.value) return Promise.resolve(user.value);
        if (!token.value) return Promise.resolve(null);

        if (getUserPromise) return getUserPromise;

        getUserPromise = axios.get(`${API_BASE_URL}/auth/user`, {
            headers: { Authorization: `Bearer ${token.value}` },
        }).then((response) => {
            if (response.data.status === 'success') {
                user.value = response.data.user;
                return response.data.user as User;
            }
            return null;
        }).catch((error: any) => {
            console.error('Get user error:', error);
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                // Token invalid — clear auth
                user.value = null;
                token.value = null;
                isAuthenticated.value = false;
                localStorage.removeItem('auth_token');
            }
            // Network errors: keep existing auth state — user is just offline
            return null;
        }).finally(() => {
            getUserPromise = null;
        });

        return getUserPromise;
    }

    /**
     * Idempotently restore the session and load the user. Safe to call from the
     * router guard, which can run before App.vue's initAuth on a hard reload —
     * so it hydrates the persisted token into the store before fetching the
     * user. Returns the user (or null when signed out / token rejected).
     */
    async function ensureSession(): Promise<User | null> {
        if (!token.value) {
            const saved = localStorage.getItem('auth_token');
            if (saved) {
                token.value = saved;
                isAuthenticated.value = true;
            }
        }
        if (!token.value) return null;
        if (user.value) return user.value;
        return getUser();
    }

    // Guard against concurrent flush calls (e.g. focus + online firing together)
    let isFlushing = false;

    /**
     * Flush any pending settings/preferences to the backend.
     * Called on reconnect, focus, and before loadSettings.
     */
    async function flushPendingSettings(): Promise<boolean> {
        if (isFlushing || !token.value) return false;
        if (!pendingSettingsUpdate.value) return false;

        isFlushing = true;
        let allFlushed = true;

        try {
            // Flush theme settings
            if (pendingSettingsUpdate.value) {
                try {
                    const response = await axios.patch(`${API_BASE_URL}/settings`, pendingSettingsUpdate.value, {
                        headers: { Authorization: `Bearer ${token.value}` },
                    });
                    if (response.data.status === 'success') {
                        remoteSettings.value = response.data.settings;
                        pendingSettingsUpdate.value = null;
                        localStorage.removeItem('pending_theme_settings');
                    } else {
                        allFlushed = false;
                    }
                } catch {
                    allFlushed = false; // Still offline
                }
            }
        } finally {
            isFlushing = false;
        }

        return allFlushed;
    }

    /**
     * Load user settings from the backend.
     * Flushes any pending local changes first — local always wins.
     */
    async function loadSettings(): Promise<UserSettings | null> {
        if (!token.value) return null;

        // Pending local changes take priority — flush before pulling server state
        if (pendingSettingsUpdate.value) {
            await flushPendingSettings();
            return remoteSettings.value;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/settings`, {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            if (response.data.status === 'success') {
                remoteSettings.value = response.data.settings;
                return response.data.settings as UserSettings;
            }
        } catch {
            // Offline — keep using local settings, no change to remoteSettings
        }
        return null;
    }

    /**
     * Persist theme settings to the backend.
     * Queues the update locally so it survives offline scenarios.
     */
    async function updateSettings(data: Partial<UserSettings>): Promise<void> {
        if (!token.value) return;

        // Merge into pending so rapid changes collapse into one request
        const merged = { ...(pendingSettingsUpdate.value ?? {}), ...data };
        pendingSettingsUpdate.value = merged;
        localStorage.setItem('pending_theme_settings', JSON.stringify(merged));

        if (isFlushing) return; // A flush is already in progress — pending will be sent then

        try {
            const response = await axios.patch(`${API_BASE_URL}/settings`, merged, {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            if (response.data.status === 'success') {
                remoteSettings.value = response.data.settings;
                pendingSettingsUpdate.value = null;
                localStorage.removeItem('pending_theme_settings');
            }
        } catch {
            // Offline — pending saved to localStorage, will flush on reconnect/focus
        }
    }

    /**
     * Initialize auth state from localStorage.
     */
    function initAuth() {
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken) {
            token.value = savedToken;
            isAuthenticated.value = true;
            // syncEnabled follows the subscription tier; getUser() loads the tier.
            getUser(true).then((u) => {
                if (u) loadSettings();
            });
        }

        // On reconnect: flush pending changes then pull fresh settings
        window.addEventListener('online', onOnline);

        // On app quit: push any unsynced changes before closing
        window.browserWindow.onSyncBeforeQuit(async () => {
            try {
                await runSync();
            } finally {
                window.browserWindow.notifySyncBeforeQuitDone();
            }
        });
    }

    async function onOnline() {
        if (!isAuthenticated.value) return;
        // If we were offline at startup, user may be null and syncEnabled may be stale.
        if (!user.value) {
            const u = await getUser();
            if (u) loadSettings();
        }
        await flushPendingSettings();
        if (!pendingSettingsUpdate.value) loadSettings();
        // Clear backoff so reconnect triggers an immediate sync rather than waiting
        // out a cooldown that was set during the offline period.
        if (window.isElectron) {
            resetSyncBackoff();
            runPullSync();
        }
    }

    /**
     * Whether cloud sync is enabled — derived purely from entitlement (the
     * `sync` service). There is no stored toggle; sync runs whenever entitled.
     */
    const syncEnabled = computed(() => isSyncEntitled.value);
    const { lastSyncAt, loadLastSyncAt } = createAuthSessionSync({
        isAuthenticated, token, flushPendingSettings,
    });

    const { forgotPassword, resetPassword, updateProfile, updateUserInfo, updateProfilePicture, resendVerification } =
        createAuthProfile(API_BASE_URL, token, user, localAvatarKey, localAvatarCache);

    return {
        user,
        token,
        services,
        hasService,
        tier,
        isSyncEntitled,
        isAuthenticated,
        syncEnabled,
        lastSyncAt,
        loadLastSyncAt,
        remoteSettings,
        pendingSettingsUpdate,
        register,
        login,
        logout,
        deleteAccount,
        getUser,
        ensureSession,
        initAuth,
        loadSettings,
        updateSettings,
        flushPendingSettings,
        localAvatarKey,
        localAvatarCache,
        forgotPassword,
        resetPassword,
        updateProfile,
        updateUserInfo,
        updateProfilePicture,
        resendVerification,
    };
});
