import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Platform, 
  StatusBar as RNStatusBar, 
  Animated, 
  Dimensions, 
  Pressable,
  PanResponder
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Screens
import LiveStream from './screens/LiveStream';
import EvidenceVault from './screens/EvidenceVault';
import DocumentScanner from './screens/DocumentScanner';
import EvidenceSearch from './screens/EvidenceSearch';
import DeviceStatus from './screens/DeviceStatus';
import AccessLogs from './screens/AccessLogs';
import UserCaseManagement from './screens/UserCaseManagement';
import AnalyticsReports from './screens/AnalyticsReports';
import Settings from './screens/Settings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 280;

type ScreenId =
  | 'liveStream'
  | 'evidenceVault'
  | 'documentScanner'
  | 'evidenceSearch'
  | 'deviceStatus'
  | 'accessLogs'
  | 'userCase'
  | 'analytics'
  | 'settings';

const screenTitles: Record<ScreenId, string> = {
  liveStream: 'Live Stream',
  evidenceVault: 'Evidence Vault',
  documentScanner: 'Document Scanner',
  evidenceSearch: 'Evidence Search',
  deviceStatus: 'Device Status',
  accessLogs: 'Access Logs / Security Events',
  userCase: 'User & Case Management',
  analytics: 'Analytics & Reports',
  settings: 'Settings',
};

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('liveStream');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dragX = useRef(0);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'liveStream':
        return <LiveStream />;
      case 'evidenceVault':
        return <EvidenceVault />;
      case 'documentScanner':
        return <DocumentScanner />;
      case 'evidenceSearch':
        return <EvidenceSearch />;
      case 'deviceStatus':
        return <DeviceStatus />;
      case 'accessLogs':
        return <AccessLogs />;
      case 'userCase':
        return <UserCaseManagement />;
      case 'analytics':
        return <AnalyticsReports />;
      case 'settings':
        return <Settings />;
      default:
        return <LiveStream />;
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
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
});

