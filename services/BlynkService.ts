import { BLYNK_CONFIG, BLYNK_PINS } from '../config/blynk.config';

class BlynkService {
  private baseUrl: string;
  private authToken: string;

  constructor(authToken?: string) {
    this.authToken = authToken || BLYNK_CONFIG.AUTH_TOKEN;
    this.baseUrl = `https://${BLYNK_CONFIG.SERVER}`;
  }

  // Set Auth Token dynamically
  setAuthToken(token: string) {
    this.authToken = token;
  }

  // Generic method to send data to Blynk
  private async sendToBlynk(pin: string, value: any): Promise<boolean> {
    if (!this.authToken) {
      console.warn('Blynk Auth Token not set');
      return false;
    }

    try {
      const url = `${this.baseUrl}/external/api/update?token=${this.authToken}&${pin}=${value}`;
      const response = await fetch(url, { method: 'GET' });
      return response.ok;
    } catch (error) {
      console.error('Blynk send error:', error);
      return false;
    }
  }

  // Generic method to get data from Blynk
  private async getFromBlynk(pin: string): Promise<any> {
    if (!this.authToken) {
      console.warn('Blynk Auth Token not set');
      return null;
    }

    try {
      const url = `${this.baseUrl}/external/api/get?token=${this.authToken}&${pin}`;
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Blynk get error:', error);
      return null;
    }
  }

  // Update stream connection status
  async updateStreamStatus(isConnected: boolean): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.STREAM_STATUS, isConnected ? 1 : 0);
  }

  // Update camera control state
  async updateCameraControl(isOn: boolean): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.CAMERA_CONTROL, isOn ? 1 : 0);
  }

  // Update stream URL
  async updateStreamUrl(url: string): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.STREAM_URL, encodeURIComponent(url));
  }

  // Trigger reconnect
  async triggerReconnect(): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.RECONNECT, 1);
  }

  // Update device status
  async updateDeviceStatus(status: string): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.DEVICE_STATUS, status);
  }

  // Update quality indicator
  async updateQuality(quality: string): Promise<boolean> {
    return this.sendToBlynk(BLYNK_PINS.QUALITY, quality);
  }

  // Get camera control state from Blynk
  async getCameraControl(): Promise<boolean> {
    const value = await this.getFromBlynk(BLYNK_PINS.CAMERA_CONTROL);
    return value === '1' || value === 1;
  }

  // Get reconnect trigger
  async getReconnectTrigger(): Promise<boolean> {
    const value = await this.getFromBlynk(BLYNK_PINS.RECONNECT);
    if (value === '1' || value === 1) {
      // Reset the trigger
      await this.sendToBlynk(BLYNK_PINS.RECONNECT, 0);
      return true;
    }
    return false;
  }

  // Send log event to Blynk
  async logEvent(eventName: string, description: string): Promise<boolean> {
    if (!this.authToken) return false;

    try {
      const url = `${this.baseUrl}/external/api/logEvent?token=${this.authToken}&code=${eventName}&description=${encodeURIComponent(description)}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.error('Blynk log event error:', error);
      return false;
    }
  }

  // Send notification through Blynk
  async sendNotification(message: string): Promise<boolean> {
    if (!this.authToken) return false;

    try {
      const url = `${this.baseUrl}/external/api/notify?token=${this.authToken}&body=${encodeURIComponent(message)}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.error('Blynk notification error:', error);
      return false;
    }
  }
}

export default BlynkService;
