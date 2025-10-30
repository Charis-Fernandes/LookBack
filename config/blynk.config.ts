// Blynk IoT Configuration
export const BLYNK_CONFIG = {
  TEMPLATE_ID: 'TMPL31Se8tinV',
  TEMPLATE_NAME: 'lookback',
  AUTH_TOKEN: 'G7eRKkORc6NNxzcuFnSkGqQLBGkn11Wj',
  SERVER: 'blynk.cloud',
  PORT: 443,
};

// Virtual Pins Configuration
export const BLYNK_PINS = {
  STREAM_STATUS: 'V0',      // Stream connection status
  CAMERA_CONTROL: 'V1',     // Camera on/off control
  STREAM_URL: 'V2',         // Current stream URL
  RECONNECT: 'V3',          // Trigger reconnect
  DEVICE_STATUS: 'V4',      // Device online/offline
  QUALITY: 'V5',            // Stream quality indicator
};

export default BLYNK_CONFIG;
