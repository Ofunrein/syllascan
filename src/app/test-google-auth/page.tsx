import GoogleAuthTest from '@/components/GoogleAuthTest';
import GoogleAuthWrapper from '@/components/GoogleAuthWrapper';
import LiveCalendarView from '@/components/LiveCalendarView';

export default function TestGoogleAuthPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Google OAuth Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Manual Authentication</h2>
          <GoogleAuthTest />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Automatic Authentication</h2>
          <p className="mb-4 text-gray-600">
            This component will automatically check if you're authenticated with Google
            and prompt you to connect if needed.
          </p>
          <GoogleAuthWrapper>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <h3 className="text-lg font-medium mb-2">Calendar Data</h3>
              <p>You are successfully authenticated with Google Calendar!</p>
              <div className="mt-4">
                <LiveCalendarView />
              </div>
            </div>
          </GoogleAuthWrapper>
        </div>
      </div>
    </div>
  );
} 