# Kilimo Connect Farmer Assistant

A lightweight mobile application designed to help smallholder farmers in Tanzania access real-time agricultural information. The app provides essential agricultural information in Swahili, making it accessible to a wider audience.

## Features

- **Weather Updates**: Real-time weather forecasts for specific regions in Tanzania
- **Pest Identification**: Image-based detection of pests and diseases with treatment suggestions
- **Market Prices**: SMS-based alerts for crop prices (works on basic phones)
- **Offline Mode**: Functionality available in low-connectivity areas
- **Language Support**: User interface in Swahili
- **Q&A System**: AI-powered advice system for farmers' questions

## Target Users

- Smallholder farmers in Tanzania
- Agricultural extension workers
- Rural communities with limited internet access

## Technology Stack

- Frontend: React Native (for cross-platform support)
- Backend: Node.js with Express
- Database: SQLite (for offline support)
- AI/ML: TensorFlow Lite (for pest identification)
- SMS Integration: Twilio API
- Weather Data: OpenWeatherMap API

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- SQLite
- TensorFlow Lite

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kadioko/Kilimo-Connect-Farmer-Assistant.git
cd Kilimo-Connect-Farmer-Assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
OPENWEATHERMAP_API_KEY=your_api_key
```

4. Initialize the database:
```bash
npm run db:init
```

5. Start the development server:
```bash
npm start
```

### Running the App

#### Android
1. Connect your Android device or start an emulator
2. Run:
```bash
npm run android
```

#### iOS
1. Open the project in Xcode
2. Select your device or simulator
3. Click the "Run" button or press ⌘ + R

### Development

The project uses React Native for the frontend and Node.js with Express for the backend. The development server will automatically reload when you make changes to the code.

### Testing

To run tests:
```bash
npm test
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
