# LookBack Admin Dashboard

A clean, modern, and minimal **React Native (TypeScript, Expo)** Admin Dashboard UI for LookBack — a law and security–focused smart glasses companion app.

## 🎯 Overview

This is a **design-only skeleton** with placeholder/mock data. No backend logic or API calls are included. The dashboard provides a professional interface for managing evidence, devices, users, and security events.

## ✨ Features

### 📱 Dashboard Sections

- **Live Stream** - Real-time video feed from smart glasses with connection status
- **Evidence Vault** - Grid layout for browsing media evidence with search
- **Document Scanner** - Camera interface for scanning documents
- **Evidence Search** - Advanced search with filters and relevance scoring
- **Device Status** - Monitor all connected smart glasses units
- **Access Logs / Security Events** - Detailed audit trail of system activities
- **User & Case Management** - Manage users and active cases
- **Analytics & Reports** - Visual data insights and report generation
- **Settings** - User preferences, security, and system configuration

### 🎨 Design Features

- **Light Theme Only** - Clean, professional appearance
- **Modern UI** - Rounded corners, subtle shadows, crisp typography
- **Responsive Layout** - Adapts to different screen sizes
- **Persistent Sidebar** - Easy navigation between sections
- **Top Header Bar** - Context-aware title and user profile
- **Minimal Animations** - Smooth transitions between screens

## 📁 Project Structure

```
/LookBack
├── App.tsx                    # Main app with navigation logic
├── components/
│   ├── Sidebar.tsx           # Left navigation sidebar
│   └── Header.tsx            # Top header bar
├── screens/
│   ├── LiveStream.tsx        # Live video stream view
│   ├── EvidenceVault.tsx     # Evidence gallery
│   ├── DocumentScanner.tsx   # Document scanning interface
│   ├── EvidenceSearch.tsx    # Search functionality
│   ├── DeviceStatus.tsx      # Device monitoring
│   ├── AccessLogs.tsx        # Security event logs
│   ├── UserCaseManagement.tsx # User and case management
│   ├── AnalyticsReports.tsx  # Analytics and charts
│   └── Settings.tsx          # Application settings
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Expo CLI
- iOS Simulator or Android Emulator (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

## 🛠️ Technologies

- **React Native** - Mobile framework
- **TypeScript** - Type-safe development
- **Expo** - Development platform
- **React Native WebView** - For live stream display
- **Firebase** - Backend services and data storage
- **UploadThing** - File upload and storage
- **Blockchain (Ethereum)** - Evidence integrity and verification
- **MetaMask** - Wallet integration for blockchain transactions
- **Ethers.js** - Ethereum blockchain interaction

## 🔗 Blockchain Integration

LookBack includes blockchain integration for evidence integrity verification:

### Features
- **SHA-256 Hashing**: All uploaded images are hashed for integrity verification
- **Blockchain Storage**: Evidence hashes are stored on Ethereum blockchain
- **Tamper Detection**: Compare stored hashes with current file hashes
- **Audit Trail**: Immutable record of evidence creation with timestamps

### Setup
1. Install and run [Ganache](https://trufflesuite.com/ganache/) for local blockchain
2. Install [MetaMask](https://metamask.io/) browser extension
3. Deploy the smart contract from `contracts/EvidenceStorage.sol`
4. Configure MetaMask to connect to Ganache network
5. Update contract address in `services/BlockchainService.ts`

See `BLOCKCHAIN_SETUP.md` for detailed instructions.

### Testing
Run the blockchain integration test:
```bash
node test-blockchain.js
```

## 📝 Notes

- All data is **mock/placeholder** - no real backend integration
- The Live Stream component uses WebView to display HTTP streams
- To change the stream URL, edit `streamUrl` in `screens/LiveStream.tsx`
- All screens are fully functional UI-wise but don't perform actual operations

## 🎨 Color Palette

- **Primary**: `#3b82f6` (Blue)
- **Background**: `#f8fafc` (Light Grey)
- **Cards**: `#ffffff` (White)
- **Text Primary**: `#1e293b` (Dark Slate)
- **Text Secondary**: `#64748b` (Slate Grey)
- **Success**: `#10b981` (Green)
- **Warning**: `#f59e0b` (Orange)
- **Danger**: `#ef4444` (Red)

## 📄 License

0BSD

## 👥 Author

LookBack Team - Law Enforcement Smart Glasses Platform