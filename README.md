# SyllaScan

<div align="center">
  <img src="public/logo.png" alt="SyllaScan Logo" width="150" />
  <h3>Transform your syllabi into calendar events with AI</h3>
</div>

## 🌟 Overview

SyllaScan is an innovative application that leverages artificial intelligence to automatically extract events, assignments, and deadlines from syllabi, schedules, and academic documents. With a single upload, students can transform dense academic documents into organized calendar events, helping them stay on top of their academic responsibilities.

## ✨ Key Features

### For Students & Educators
- **📝 One-Click Document Scanning**: Upload syllabi, assignment sheets, or schedules in PDF, JPG, or PNG format
- **🔍 AI-Powered Event Detection**: Intelligent extraction of due dates, exams, project deadlines, and class schedules
- **📅 Seamless Google Calendar Integration**: Add events directly to your personal or academic calendar
- **📱 Mobile-Friendly Interface**: Access and manage your academic schedule on any device
- **🔄 Batch Processing**: Upload multiple documents at once to process an entire semester's worth of schedules
- **🔒 Secure Document Handling**: Your academic information remains private and is not stored after processing

### For Technical Users
- **🧠 Advanced NLP Processing**: Fine-tuned OpenAI Vision models extract complex academic event patterns
- **⚡ Real-time Event Editing**: Modify detected events before committing to calendar
- **🔄 Processing History**: Track document uploads and extraction success rates
- **🌓 Dark/Light Mode Support**: Optimized UI for all environments and accessibility needs
- **🔌 Extensible API Architecture**: Well-structured endpoints for potential integration with LMS platforms

## 🛠️ Technology Stack

### Frontend Technologies
- **Next.js 15**: Leveraging the latest React framework with server components for optimal performance
- **React 19**: Utilizing modern React patterns including hooks, context, and composition
- **Tailwind CSS 4**: Implementing responsive design with utility-first CSS framework
- **React Big Calendar**: Interactive calendar visualization with day, week, and month views
- **TypeScript**: Static typing for enhanced code quality and developer experience

### Backend & Services
- **Firebase Authentication**: Secure OAuth 2.0 integration with Google accounts
- **Firebase Firestore**: NoSQL document database for user data and processing history
- **Firebase Admin SDK**: Server-side authentication and authorization
- **NextAuth.js**: Advanced authentication patterns with JWT session handling

### AI & Data Processing
- **OpenAI Vision API**: Advanced document understanding and entity extraction
- **PDF.js**: Client-side PDF rendering and processing
- **Google Calendar API**: Seamless integration with Google's calendar services
- **Custom OCR Pipeline**: Enhanced text extraction from image-based documents

### DevOps & Deployment
- **Vercel**: Edge-optimized hosting with global CDN
- **GitHub Actions**: Automated CI/CD workflows
- **Jest & React Testing Library**: Comprehensive test coverage
- **ESLint & Prettier**: Code quality enforcement

## 📊 Performance Optimizations

- Server-side rendering for critical pages
- Edge functions for API routes
- Incremental Static Regeneration for dashboard views
- Image optimization with Next.js Image component
- Route prefetching for instant navigation
- AI processing optimized for speed and accuracy

## 📱 Real-World Applications

### Academic Success
- Students can visualize their entire semester at a glance
- Reduced missed assignments and improved time management
- More effective study scheduling and deadline awareness

### Academic Advisors & Educators
- Help students with learning disabilities organize their academic responsibilities
- Create unified calendars for departmental events and deadlines
- Monitor academic workload distribution across the semester

### Administrative Efficiency
- Standardize event extraction from institutional documents
- Automate calendar population for orientation and special events
- Ensure consistent formatting across departmental calendars

## 🚀 Getting Started

### For Users
1. Visit [syllascan.app](https://syllascan.app) or your deployed instance
2. Sign in with your Google account
3. Upload your syllabus or academic document
4. Review the automatically detected events
5. Add events to your Google Calendar with one click

### For Developers
1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/syllascan.git
   ```

2. Install dependencies
   ```bash
   cd syllascan
   npm install
   ```

3. Set up environment variables (see `.env.example`)

4. Start the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📈 Future Roadmap

- **Enhanced AI Models**: Training on academic-specific datasets for improved accuracy
- **Canvas/Blackboard Integration**: Direct import from learning management systems
- **Collaborative Calendars**: Shared calendars for study groups and team projects
- **Smart Notifications**: AI-powered reminders based on event importance and workload
- **Export Options**: Additional calendar formats including iCal and Outlook
- **Workload Visualization**: Heatmaps showing busy periods and potential conflicts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [OpenAI](https://openai.com/) for the Vision API
- [Google Calendar API](https://developers.google.com/calendar) for calendar integration
- [Firebase](https://firebase.google.com/) for authentication and database
- [Next.js](https://nextjs.org/) for the framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- All the students who provided feedback during development
