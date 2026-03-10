# 📸 UploadThing + Firebase Setup Guide for LookBack

## ✅ What's Implemented

### 1. **UploadThing Integration** (Image Storage)
- ✅ Capture snapshots from ESP32-CAM live stream
- ✅ Upload to UploadThing cloud storage
- ✅ Store URLs locally with AsyncStorage
- ✅ Display in Evidence Vault gallery
- ✅ Delete functionality with long-press

### 2. **Services Created**
- **UploadThingService** - Handles all cloud uploads
- **LocalStorageService** - Tracks uploaded images locally
- **BlynkService** - IoT notifications and logging

---

## 🚀 Quick Start

### Your UploadThing Credentials (Already Configured)
```
TOKEN: eyJhcGlLZXkiOiJza19saXZlXzYyMTA0Yzg4MjViZThkNjhlYjZjODk5NDA2NTU0N2QyNGU5NmQ4MzQ3NzQ0MTJiOGY2OGVmOTNlMDg2MjA1ZjQiLCJhcHBJZCI6ImhjNThnc2V4NTciLCJyZWdpb25zIjpbInNlYTEiXX0=
APP_ID: hc58gsex57
REGION: sea1 (Southeast Asia)
```

---

## 📋 Features Overview

### Live Stream Screen
1. **📸 Capture Button** - New green button between Stop and Reconnect
2. **Real-time Upload** - Captures current frame and uploads to cloud
3. **Blynk Integration** - Sends notifications when snapshot is captured
4. **Visual Feedback** - Loading spinner while capturing/uploading

### Evidence Vault Screen
1. **Image Gallery** - 2-column grid layout
2. **Pull to Refresh** - Swipe down to reload snapshots
3. **Long Press to Delete** - Hold on image to delete
4. **Metadata Display** - Shows capture date and quality
5. **Empty State** - Helpful message when no snapshots exist

---

## 🔧 How It Works

### Capture Flow
```
1. User taps "📸 Capture" button
2. App fetches image from ESP32-CAM /capture endpoint
3. Converts image to base64 data URL
4. Uploads to UploadThing cloud storage
5. Saves URL + metadata to local AsyncStorage
6. Sends Blynk notification
7. Shows success alert to user
```

### Storage Flow
```
UploadThing (Cloud)          AsyncStorage (Local)
     ↓                              ↓
Image Files (JPG)          URLs + Metadata (JSON)
     ↓                              ↓
Permanent Storage          Quick Access & Tracking
```

---

## 📂 File Structure

```
/config
  ├── uploadthing.config.ts    # UploadThing credentials
  └── blynk.config.ts          # Blynk IoT config

/services
  ├── UploadThingService.ts    # Upload logic
  ├── LocalStorageService.ts   # Local data management
  └── BlynkService.ts          # IoT notifications

/screens
  ├── LiveStream.tsx           # Stream + Capture button
  └── EvidenceVault.tsx        # Gallery viewer
```

---

## 🎯 Usage Instructions

### Capturing Snapshots

1. **Connect to Stream**
   - Make sure stream is showing live video
   - Status should show "Connected" (green dot)

2. **Capture Snapshot**
   - Tap the **📸 Capture** button
   - Wait for "⏳" loading indicator
   - Success alert will appear when done

3. **View in Evidence Vault**
   - Navigate to "Evidence Vault" from sidebar
   - See all captured snapshots in grid
   - Pull down to refresh

### Managing Snapshots

**View Full Size:**
- Tap on any snapshot card

**Delete Snapshot:**
- Long-press on a snapshot
- Confirm deletion in alert dialog

**Refresh List:**
- Pull down on Evidence Vault screen

---

## 🔐 Security & Storage

### UploadThing
- **CDN Hosting**: Images served globally via Cloudflare
- **Automatic Optimization**: Images compressed for fast loading
- **Secure URLs**: Each upload gets a unique secure URL
- **Region**: sea1 (Southeast Asia - optimal for your location)

### Local Storage (AsyncStorage)
- Stores metadata only (not actual images)
- Tracks: URL, timestamp, device ID, quality, case ID
- Persists across app restarts
- Can be cleared via settings

---

## 📊 Metadata Saved with Each Snapshot

```typescript
{
  id: 'snapshot_1730908800000',
  url: 'https://utfs.io/f/abc123...',
  timestamp: 1730908800000,
  deviceId: 'esp32-cam',
  quality: 'HD',
  streamUrl: 'http://10.56.141.207:81/stream',
  caseId: 'optional-case-id'
}
```

---

## 🚨 Troubleshooting

### "Failed to capture snapshot"
**Causes:**
- Stream is not connected
- ESP32-CAM /capture endpoint not available
- Network connectivity issue

**Solutions:**
- Ensure stream is showing live video
- Test capture URL: `http://YOUR_IP:81/capture`
- Check ESP32-CAM is powered on

### "Upload failed"
**Causes:**
- UploadThing token invalid
- Network timeout
- File size too large

**Solutions:**
- Verify token in `config/uploadthing.config.ts`
- Check internet connection
- ESP32-CAM captures should be small enough

### "No snapshots showing"
**Causes:**
- No snapshots captured yet
- AsyncStorage cleared
- App data reset

**Solutions:**
- Capture a new snapshot
- Pull down to refresh Evidence Vault
- Check console logs for errors

---

## 🎨 Customization Options

### Change Capture Quality
Edit `LiveStream.tsx`:
```typescript
quality: 'SD' // or 'HD' or 'UHD'
```

### Change Grid Columns
Edit `EvidenceVault.tsx`:
```typescript
const CARD_WIDTH = (width - 48) / 3; // 3 columns
numColumns={3}
```

### Add Case IDs
When capturing, pass case ID:
```typescript
caseId: 'CASE-2025-001'
```

---

## 📈 UploadThing Free Tier Limits

- **Storage**: 2 GB
- **Bandwidth**: 2 GB/month
- **File Size**: 4 MB per file
- **Uploads**: Unlimited

Your ESP32-CAM images are typically 50-200 KB, so you can store:
- ~10,000 - 40,000 snapshots

---

## 🔄 Future Enhancements

### Planned Features
- [ ] Firebase Firestore for metadata (instead of AsyncStorage)
- [ ] User authentication (Firebase Auth)
- [ ] Search and filter snapshots
- [ ] Share snapshots via link
- [ ] Bulk download
- [ ] Auto-backup to multiple clouds
- [ ] Facial recognition tagging
- [ ] Case management integration

---

## 🆘 Support

### UploadThing Dashboard
- URL: https://uploadthing.com/dashboard
- App ID: `hc58gsex57`
- View uploads, usage, and analytics

### Console Logging
All operations log to console:
- `✅` = Success
- `❌` = Error
- `📸` = Capture
- `⬆️` = Upload
- `📁` = Storage

Check Metro bundler or React Native debugger for logs.

---

## ✨ Summary

You now have a complete cloud storage solution for your LookBack ESP32-CAM snapshots:

1. **Capture** - Tap button on Live Stream
2. **Upload** - Automatic cloud storage via UploadThing
3. **Track** - Local database of all snapshots
4. **View** - Beautiful gallery in Evidence Vault
5. **Delete** - Long-press to remove
6. **Notify** - Blynk notifications on capture

Everything is configured and ready to use! 🎉
