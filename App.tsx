import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text,
  Button,
  StyleSheet, 
  Platform, 
  StatusBar as RNStatusBar, 
  Animated, 
  Dimensions, 
  Pressable,
  PanResponder,
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseService from './services/FirebaseService';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Screens
import LiveStream from './screens/LiveStream';
import DocumentScanner from './screens/DocumentScanner';
import EvidenceSearch from './screens/EvidenceSearch';
import EvidenceVault from './screens/EvidenceVault';
import AccessLogs from './screens/AccessLogs';
import AnalyticsReports from './screens/AnalyticsReports';
import Settings from './screens/Settings';
import UserProfileService, { UserProfile } from './services/UserProfileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 280;

type ScreenId =
  | 'evidenceSearch'
  | 'evidenceVault'
  | 'documentScanner'
  | 'liveStream'
  | 'analytics'
  | 'userLogs'
  | 'settings';

const screenTitles: Record<ScreenId, string> = {
  evidenceSearch: 'Evidence Search',
  evidenceVault: 'Evidence Vault',
  documentScanner: 'Document Scanner',
  liveStream: 'Live Stream',
  analytics: 'Analytics & Reports',
  userLogs: 'Access Logs',
  settings: 'Settings',
};

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('evidenceSearch');
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletDebug, setWalletDebug] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({});

  const isWeb = Platform.OS === 'web';

  const getEthereumProvider = () => {
    const anyWindow = (globalThis as any)?.window;
    const ethereum = anyWindow?.ethereum;

    if (!ethereum) return null;

    if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
      const metamaskProvider = ethereum.providers.find((provider: any) => provider?.isMetaMask);
      return metamaskProvider || ethereum.providers[0];
    }

    return ethereum;
  };

  const fetchCachedAddress = async () => {
    try {
      const cached = await AsyncStorage.getItem('walletAddress');
      if (!cached) return;

      const isBlocked = await FirebaseService.isUserLoginBlocked(cached);
      if (isBlocked) {
        setWalletAddress(null);
        setWalletError('This wallet is blocked by an administrator.');
        await AsyncStorage.removeItem('walletAddress');
        return;
      }

      setWalletAddress(cached);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCachedAddress();
  }, []);

  const loadProfile = useCallback(async () => {
    const data = await UserProfileService.getProfile();
    setProfile(data);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isWeb) return;

    const provider = getEthereumProvider();
    setWalletDebug(provider ? 'MetaMask provider detected' : 'MetaMask provider not detected');

    const syncWalletState = async () => {
      try {
        if (!provider?.request) return;

        const [accounts, currentChainId] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' }),
        ]);

        if (accounts?.[0]) {
          const account = accounts[0];
          const isBlocked = await FirebaseService.isUserLoginBlocked(account);
          if (isBlocked) {
            setWalletAddress(null);
            setWalletError('This wallet is blocked by an administrator.');
            await AsyncStorage.removeItem('walletAddress');
            return;
          }

          setWalletAddress(account);
        }

        if (currentChainId) {
          setChainId(currentChainId);
        }
      } catch (error: any) {
        setWalletDebug(error?.message ?? 'Could not read MetaMask state');
      }
    };

    syncWalletState();
  }, [isWeb]);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;
    const enforceBlockedWallet = async () => {
      try {
        const isBlocked = await FirebaseService.isUserLoginBlocked(walletAddress);
        if (!isBlocked || cancelled) return;

        setWalletAddress(null);
        setWalletDebug('Wallet blocked by administrator');
        setWalletError('This wallet is blocked by an administrator.');
        await AsyncStorage.removeItem('walletAddress');
      } catch (error) {
        console.warn('Blocked wallet check failed:', error);
      }
    };

    enforceBlockedWallet();
    const timer = setInterval(enforceBlockedWallet, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [walletAddress]);

  const disconnectWallet = async () => {
    const disconnectedAddress = walletAddress;
    setWalletAddress(null);
    setWalletError(null);
    setWalletDebug('Wallet disconnected');
    await AsyncStorage.removeItem('walletAddress');

    if (disconnectedAddress) {
      const actor = await UserProfileService.getAuditIdentity();
      await FirebaseService.logAccess({
        userId: disconnectedAddress,
        userName: actor.userName,
        action: 'MetaMask logout',
        resource: `Chain ${chainId || 'unknown'}`,
        timestamp: Date.now(),
      });
    }
  };

  const connectWallet = async () => {
    setWalletError(null);
    setIsConnecting(true);
    setWalletDebug('Connect button clicked');

    try {
      if (!isWeb) {
        throw new Error('MetaMask login is currently supported only on web (browser).');
      }

      const providerInstance = getEthereumProvider();
      if (!providerInstance?.request) {
        throw new Error('MetaMask extension not found. Please install MetaMask in your browser.');
      }

      setWalletDebug('Requesting account access from MetaMask');
      const accounts = await providerInstance.request({ method: 'eth_requestAccounts' });
      const currentChainId = await providerInstance.request({ method: 'eth_chainId' });

      const provider = new ethers.BrowserProvider(providerInstance);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const isBlocked = await FirebaseService.isUserLoginBlocked(address);
      if (isBlocked) {
        throw new Error('This wallet is blocked by an administrator.');
      }

      setWalletAddress(address);
      setChainId(currentChainId ?? null);
      setWalletDebug(`Connected: ${accounts?.[0] || address}`);
      await AsyncStorage.setItem('walletAddress', address);

      const actor = await UserProfileService.getAuditIdentity();
      await FirebaseService.logAccess({
        userId: address,
        userName: actor.userName,
        action: 'MetaMask login',
        resource: `Chain ${currentChainId || 'unknown'}`,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      setWalletError(error?.message ?? 'Wallet connection failed');
      setWalletDebug(error?.code ? `MetaMask error code: ${error.code}` : 'Wallet connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dragX = useRef(0);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'evidenceSearch':
        return <EvidenceSearch />;
      case 'evidenceVault':
        return <EvidenceVault />;
      case 'documentScanner':
        return <DocumentScanner />;
      case 'liveStream':
        return <LiveStream />;
      case 'analytics':
        return <AnalyticsReports />;
      case 'userLogs':
        return <AccessLogs />;
      case 'settings':
        return <Settings onProfileSaved={loadProfile} />;
      default:
        return <EvidenceSearch />;
    }
  };

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen as ScreenId);
    closeSidebar();
  };

  const openSidebar = () => {
    setSidebarVisible(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 50,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -SIDEBAR_WIDTH,
        useNativeDriver: true,
        friction: 9,
        tension: 50,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSidebarVisible(false);
    });
  };

  const toggleSidebar = () => {
    if (sidebarVisible) {
      closeSidebar();
    } else {
      openSidebar();
    }
  };

  // PanResponder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        const { pageX } = evt.nativeEvent;
        // Activate if starting from left edge (first 30px) or sidebar is open
        return pageX < 30 || sidebarVisible;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Activate if horizontal movement is greater than vertical
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5;
      },
      onPanResponderGrant: () => {
        dragX.current = 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;
        dragX.current = dx;

        if (sidebarVisible) {
          // Sidebar is open, allow dragging to close
          const newValue = Math.max(-SIDEBAR_WIDTH, Math.min(0, dx));
          translateX.setValue(newValue);
          overlayOpacity.setValue((SIDEBAR_WIDTH + newValue) / SIDEBAR_WIDTH);
        } else {
          // Sidebar is closed, allow dragging to open
          const newValue = Math.max(-SIDEBAR_WIDTH, Math.min(0, -SIDEBAR_WIDTH + dx));
          translateX.setValue(newValue);
          overlayOpacity.setValue((SIDEBAR_WIDTH + newValue) / SIDEBAR_WIDTH);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        const velocity = vx;

        if (sidebarVisible) {
          // Sidebar is open
          if (dx < -SIDEBAR_WIDTH / 3 || velocity < -0.5) {
            closeSidebar();
          } else {
            openSidebar();
          }
        } else {
          // Sidebar is closed
          if (dx > SIDEBAR_WIDTH / 3 || velocity > 0.5) {
            openSidebar();
          } else {
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: -SIDEBAR_WIDTH,
                useNativeDriver: true,
                friction: 9,
                tension: 50,
              }),
              Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
      },
    })
  ).current;
  if (!walletAddress) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>LookBack Admin Dashboard</Text>
          <Text style={styles.loginSubtitle}>Please connect with MetaMask to continue.</Text>
          {!isWeb && (
            <Text style={styles.loginError}>MetaMask login is only supported in web browsers.</Text>
          )}
          {walletError && <Text style={styles.loginError}>{walletError}</Text>}
          {walletDebug && <Text style={styles.loginDebug}>{walletDebug}</Text>}
          {chainId && <Text style={styles.loginDebug}>Chain ID: {chainId}</Text>}
          <View style={styles.loginButtonWrapper}>
            <Button
              title={isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
              onPress={connectWallet}
              disabled={isConnecting || !isWeb}
            />
          </View>
          {walletAddress && (
            <View style={styles.loginInfo}>
              <Text>Connected: {walletAddress}</Text>
              <Button title="Logout" onPress={disconnectWallet} />
            </View>
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.appContainer}>
        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {/* Header */}
          <Header 
            title={screenTitles[activeScreen]} 
            onMenuPress={toggleSidebar}
            walletAddress={walletAddress}
            displayName={profile.name || ''}
            photoUrl={profile.photoUrl || ''}
            onLogout={disconnectWallet}
          />

          {/* Screen Content */}
          <View style={styles.screenContainer}>{renderScreen()}</View>
        </View>

        {/* Overlay */}
        {sidebarVisible && (
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={closeSidebar}
          >
            <Animated.View
              style={[
                styles.overlay,
                {
                  opacity: overlayOpacity,
                },
              ]}
            />
          </Pressable>
        )}

        {/* Swipeable Sidebar */}
        <Animated.View
          style={[
            styles.sidebarContainer,
            {
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Sidebar
            activeScreen={activeScreen}
            onNavigate={handleNavigate}
          />
        </Animated.View>

        {/* Edge Swipe Zone - for opening sidebar */}
        {!sidebarVisible && (
          <View 
            style={styles.edgeSwipeZone}
            {...panResponder.panHandlers}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  appContainer: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    elevation: 16,
    zIndex: 1000,
  },
  edgeSwipeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 18,
    textAlign: 'center',
  },
  loginButtonWrapper: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 16,
  },
  loginInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  loginError: {
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  loginDebug: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
});
