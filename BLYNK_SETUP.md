# Blynk IoT Integration Setup Guide

## Overview
LookBack now integrates with Blynk IoT platform for remote monitoring and control of your ESP32-CAM live stream.

## Template Information
- **Template ID:** TMPL31Se8tinV
- **Template Name:** lookback
- **Server:** blynk.cloud

## Virtual Pin Mappings

| Pin | Purpose | Type | Description |
|-----|---------|------|-------------|
| V0 | Stream Status | Output | 1 = Connected, 0 = Disconnected |
| V1 | Camera Control | Input/Output | 1 = On, 0 = Off |
| V2 | Stream URL | Output | Current stream URL |
| V3 | Reconnect Trigger | Input | Write 1 to trigger reconnect |
| V4 | Device Status | Output | Status text (Online/Error) |
| V5 | Quality Indicator | Output | Stream quality (Good/Offline) |

## Setup Steps

### 1. Create Blynk Account
1. Go to [blynk.cloud](https://blynk.cloud)
2. Sign up for a free account
3. Create a new template or use existing template `TMPL31Se8tinV`

### 2. Get Your Auth Token
1. In Blynk console, go to **Devices**
2. Create a new device or select existing
3. Copy your **Auth Token** (looks like: `abcd1234efgh5678ijkl9012mnop3456`)

### 3. Configure LookBack App
1. Open LookBack app
2. Navigate to **Settings** screen (bottom of sidebar)
3. Scroll to **Blynk IoT Integration** section
4. Paste your Auth Token
5. Tap **Connect to Blynk**

### 4. Configure Blynk Dashboard (Web/Mobile)

#### Datastreams Setup
Create these Virtual Pin datastreams in your template:

**V0 - Stream Status**
- Name: Stream Status
- Pin: V0
- Data Type: Integer
- Min: 0, Max: 1
- Default: 0

**V1 - Camera Control**
- Name: Camera Control
- Pin: V1
- Data Type: Integer
- Min: 0, Max: 1
- Default: 1

**V2 - Stream URL**
- Name: Stream URL
- Pin: V2
- Data Type: String
- Max Length: 100

**V3 - Reconnect**
- Name: Reconnect Trigger
- Pin: V3
- Data Type: Integer
- Min: 0, Max: 1
- Default: 0

**V4 - Device Status**
- Name: Device Status
- Pin: V4
- Data Type: String
- Max Length: 50

**V5 - Quality**
- Name: Stream Quality
- Pin: V5
- Data Type: String
- Max Length: 20

#### Widget Suggestions

**Live Stream Status (LED Widget)**
- Datastream: V0 (Stream Status)
- Shows green when stream is active

**Camera On/Off (Switch Widget)**
- Datastream: V1 (Camera Control)
- Control camera power remotely

**Reconnect Button (Button Widget)**
- Datastream: V3 (Reconnect Trigger)
- Mode: Push
- Output: 1
- Triggers stream reconnection

**Stream URL (Label Widget)**
- Datastream: V2 (Stream URL)
- Displays current stream URL

**Device Status (Label Widget)**
- Datastream: V4 (Device Status)
- Shows connection status

**Quality Indicator (Label Widget)**
- Datastream: V5 (Quality)
- Shows stream quality

## Features

### Automatic Updates
LookBack automatically sends updates to Blynk when:
- Stream connects/disconnects
- Stream URL changes
- Device status changes
- Quality changes

### Remote Control
From Blynk dashboard you can:
- Turn camera on/off
- Trigger stream reconnection
- Monitor connection status
- View stream quality

### Notifications
LookBack sends Blynk notifications when:
- Stream goes live: "📹 LookBack stream is now live!"
- Connection errors occur

### Event Logging
All events are logged to Blynk:
- `STREAM_CONNECT` - Stream connected successfully
- `STREAM_RECONNECT` - Reconnection attempt
- `STREAM_ERROR` - Connection error
- `URL_CHANGE` - Stream URL updated

## Polling Interval
- LookBack polls Blynk every **3 seconds** for remote control commands
- This ensures near real-time response to Blynk dashboard actions

## Troubleshooting

### Auth Token Not Working
- Verify token is correct (no spaces)
- Check device is created in Blynk console
- Ensure device is not already connected elsewhere

### Virtual Pins Not Updating
- Verify datastreams are configured correctly
- Check network connectivity
- Verify auth token has permissions

### No Notifications
- Enable notifications in Blynk mobile app settings
- Verify notification quota (free tier has limits)

### Remote Control Not Working
- Check polling is active (token must be set)
- Verify datastream V1 and V3 are configured
- Ensure write permissions on pins

## API Endpoints Used

LookBack uses Blynk HTTP API:
- `GET /external/api/update?token=TOKEN&PIN=VALUE` - Update pin
- `GET /external/api/get?token=TOKEN&PIN` - Read pin
- `GET /external/api/logEvent?token=TOKEN&code=CODE&description=DESC` - Log event
- `GET /external/api/notify?token=TOKEN&body=MESSAGE` - Send notification

## Security Notes
- Auth token is stored securely using AsyncStorage
- Token is never logged or displayed in plain text
- Use HTTPS for all Blynk communication
- Keep your auth token private

## Next Steps
1. Set up Blynk dashboard with suggested widgets
2. Configure notifications
3. Test remote control features
4. Monitor stream status from anywhere

## Support
For Blynk-specific issues, visit [Blynk Documentation](https://docs.blynk.io)
