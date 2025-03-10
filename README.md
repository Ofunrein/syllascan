# SyllaScan

SyllaScan is an application that helps you extract events from syllabi and other documents and add them to your Google Calendar.

## Getting Started

### Running the Application

1. Navigate to the `gcalocr` directory (not `gcalocr-app`)
2. Run the start script:
   ```bash
   ./start-app.sh
   ```
3. Open your browser and go to [http://localhost:3000](http://localhost:3000)

## Authentication

SyllaScan uses a simplified authentication flow:

1. **Sign in with Google** using the button in the top-right corner
2. This single sign-in grants access to ALL features including calendar
3. No additional authentication steps are needed for calendar features

## Features

### Upload Document

Upload your syllabus or document to extract events. Supports JPG, PNG, GIF, and PDF files.

### Event List

View and edit the events extracted from your document.

### Calendar View

Preview how the extracted events will appear in a calendar.

### Live Calendar

View your actual Google Calendar within the app. Automatically available after signing in with Google.

### Embedded Calendar

View your Google Calendar in an embedded iframe. Automatically available after signing in with Google.

## Troubleshooting

### Google Calendar Authentication Issues

If you're experiencing issues with Google Calendar authentication:

1. **Clear Browser Cookies**: Clear your browser cookies to remove any existing Google authentication data.

2. **Sign Out and Sign In Again**: Sign out using the menu in the top-right corner, then sign in again with Google.

3. **Check Browser Console**: Open your browser's developer tools (F12) and check the console for any error messages.

### Wrong Calendar Showing

If you're seeing the wrong calendar:

1. Sign out using the menu in the top-right corner
2. Clear your browser cookies
3. Sign in again with the correct Google account

### "Failed to add events to calendar" Error

If you're seeing a "Failed to add events to calendar" error:

1. Make sure you're signed in with a Google account that has permission to add events to the calendar
2. Check that you've granted the necessary permissions during the Google sign-in process
3. Try signing out and signing back in with your Google account

## Development

To run the application in development mode:

1. Navigate to the `gcalocr-app` directory:
   ```bash
   cd gcalocr-app
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Features

- **Document Scanning**: Upload syllabi or documents (images and PDFs) to extract event information
- **AI-Powered Extraction**: Uses OpenAI's Vision API to intelligently identify events
- **Google Calendar Integration**: Seamlessly add events to your Google Calendar
- **User Authentication**: Secure login with Google accounts
- **Event Editing**: Review and edit extracted events before adding to calendar
- **Processing History**: Track your document uploads and event extractions
- **Error Handling**: Robust error boundaries to ensure a smooth user experience
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Authentication**: Firebase Authentication with Google
- **Database**: Firebase Firestore
- **AI**: OpenAI Vision API
- **Calendar Integration**: Google Calendar API
- **PDF Processing**: PDF.js

## Deployment

### Deploy to Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase:
   ```bash
   firebase init
   ```

4. Build the application:
   ```bash
   npm run build
   ```

5. Deploy to Firebase:
   ```bash
   firebase deploy
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [OpenAI](https://openai.com/) for the Vision API
- [Google Calendar API](https://developers.google.com/calendar) for calendar integration
- [Firebase](https://firebase.google.com/) for authentication and database
- [Next.js](https://nextjs.org/) for the framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
