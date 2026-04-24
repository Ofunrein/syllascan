#!/bin/bash

# Print a message to the user
echo "Starting SyllaScan application..."
echo ""
echo "=== IMPORTANT AUTHENTICATION INFORMATION ==="
echo "SyllaScan now uses a simplified authentication flow:"
echo "1. Sign in with Google using the button in the top-right corner"
echo "2. This single sign-in grants access to ALL features including calendar"
echo "3. No additional authentication steps are needed for calendar features"
echo ""
echo "If you're experiencing issues with Google Calendar authentication,"
echo "please clear your browser cookies before running the application."
echo "================================================"
echo ""

# Change to the app directory
cd "$(dirname "$0")/gcalocr-app"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: Could not find package.json in the gcalocr-app directory."
  echo "Please make sure you're running this script from the correct location."
  exit 1
fi

# Start the development server
echo "Starting Next.js development server..."
npm run dev 