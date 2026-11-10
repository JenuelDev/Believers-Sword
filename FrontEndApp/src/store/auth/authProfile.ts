import axios from 'axios';
import type { Ref } from 'vue';
import type { User } from '../authStore';

export function createAuthProfile(API_BASE_URL: string, token: Ref<string | null>, user: Ref<User | null>,
    localAvatarKey: Ref<string | null>, localAvatarCache: Ref<string | null>) {
    async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
            return {
                success: response.data.status === 'success',
                message: response.data.message ?? 'Failed to send reset link',
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to send reset link',
            };
        }
    }

    async function updateProfile(
        data: { name?: string; username?: string; email?: string }
    ): Promise<{ success: boolean; message?: string; emailVerificationSent?: boolean }> {
        if (!token.value) return { success: false, message: 'Not authenticated' };
        try {
            const response = await axios.patch(`${API_BASE_URL}/auth/profile`, data, {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            if (response.data.status === 'success') {
                user.value = response.data.user;
                return { success: true, emailVerificationSent: response.data.email_verification_sent === true };
            }
            return { success: false, message: 'Failed to update profile' };
        } catch (error: any) {
            const validationErrors = error.response?.data?.errors;
            const firstError = validationErrors
                ? Object.values(validationErrors).flat()[0] as string
                : null;
            return {
                success: false,
                message: firstError || error.response?.data?.message || error.message || 'Failed to update profile',
            };
        }
    }

    async function updateUserInfo(
        data: { denomination?: string | null }
    ): Promise<{ success: boolean; message?: string }> {
        if (!token.value) return { success: false, message: 'Not authenticated' };
        try {
            const response = await axios.patch(`${API_BASE_URL}/user-info`, data, {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            if (response.data.status === 'success') {
                if (user.value) {
                    user.value = { ...user.value, info: response.data.info };
                }
                return { success: true };
            }
            return { success: false, message: 'Failed to update info' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to update info',
            };
        }
    }

    function fileToDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = (e) => resolve(e.target!.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Set profile picture.
     * For default app pictures pass `{ type: 'default', name: 'app_profile1.png' }`.
     * For custom uploads pass `{ type: 'upload', file: File }` , the file must
     * already be compressed to < 60 KB by the caller.
     */
    async function updateProfilePicture(
        payload: { type: 'default'; name: string } | { type: 'upload'; files: Record<number, File> }
    ): Promise<{ success: boolean; message?: string; profile_picture?: string }> {
        if (!token.value) return { success: false, message: 'Not authenticated' };

        try {
            const form = new FormData();
            form.append('type', payload.type);
            if (payload.type === 'default') {
                form.append('name', payload.name);
            } else {
                for (const [size, file] of Object.entries(payload.files)) {
                    form.append(`image_${size}`, file);
                }
            }

            const response = await axios.post(`${API_BASE_URL}/user-info/profile-picture`, form, {
                headers: {
                    Authorization: `Bearer ${token.value}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.status === 'success') {
                if (user.value) {
                    user.value = { ...user.value, info: response.data.info };
                }

                if (payload.type === 'upload') {
                    // Cache the 400px version locally so it shows offline next launch.
                    try {
                        const file400 = payload.files[400];
                        if (file400) {
                            const dataUrl = await fileToDataUrl(file400);
                            localAvatarKey.value   = response.data.profile_picture;
                            localAvatarCache.value = dataUrl;
                            localStorage.setItem('profile_avatar_key',  response.data.profile_picture);
                            localStorage.setItem('profile_avatar_data', dataUrl);
                        }
                    } catch { /* non-critical */ }
                } else {
                    // Switched to a default avatar , clear any old custom cache.
                    localAvatarKey.value   = null;
                    localAvatarCache.value = null;
                    localStorage.removeItem('profile_avatar_key');
                    localStorage.removeItem('profile_avatar_data');
                }

                return { success: true, profile_picture: response.data.profile_picture };
            }
            return { success: false, message: 'Failed to update profile picture' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to update profile picture',
            };
        }
    }

    async function resendVerification(): Promise<{ success: boolean; message: string; alreadyVerified?: boolean }> {
        if (!token.value) return { success: false, message: 'Not authenticated' };
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/resend-verification`, {}, {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            return {
                success: response.data.status === 'success',
                message: response.data.message ?? 'Verification email sent.',
                alreadyVerified: response.data.already_verified === true,
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to send verification email',
            };
        }
    }

    async function resetPassword(
        token: string,
        email: string,
        password: string,
        passwordConfirmation: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
                token,
                email,
                password,
                password_confirmation: passwordConfirmation,
            });
            return {
                success: response.data.status === 'success',
                message: response.data.message ?? 'Failed to reset password',
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to reset password',
            };
        }
    }

    return { forgotPassword, resetPassword, updateProfile, updateUserInfo, updateProfilePicture, resendVerification };
}
