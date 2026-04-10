import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  name?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
}

export interface AuditIdentity {
  userId: string;
  userName: string;
  walletAddress?: string;
  profile: UserProfile;
}

const PROFILE_KEY = '@lookback_user_profile';
const WALLET_KEY = 'walletAddress';

const sanitizeProfile = (profile: UserProfile): UserProfile => ({
  name: profile.name?.trim() || '',
  phone: profile.phone?.trim() || '',
  email: profile.email?.trim() || '',
  photoUrl: profile.photoUrl?.trim() || '',
});

class UserProfileService {
  async getProfile(): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(PROFILE_KEY);
      if (!data) return {};
      return JSON.parse(data) as UserProfile;
    } catch (error) {
      console.warn('Failed to load user profile:', error);
      return {};
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const sanitized = sanitizeProfile(profile);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(sanitized));
  }

  async getAuditIdentity(): Promise<AuditIdentity> {
    const [profile, walletAddress] = await Promise.all([
      this.getProfile(),
      AsyncStorage.getItem(WALLET_KEY),
    ]);

    const normalizedWallet = walletAddress?.trim() || '';
    const normalizedName = profile.name?.trim() || '';

    return {
      userId: normalizedWallet || 'unknown',
      userName: normalizedName || normalizedWallet || 'unknown',
      walletAddress: normalizedWallet || undefined,
      profile,
    };
  }
}

export default new UserProfileService();
