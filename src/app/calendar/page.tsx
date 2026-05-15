import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import { CalendarQueryProvider } from '@/components/calendar/QueryProvider';
import { CalendarShell } from '@/components/calendar/CalendarShell';

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col overflow-hidden px-2 py-2">
        <div className="liquid-glass rounded-2xl flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CalendarQueryProvider>
            <CalendarShell />
          </CalendarQueryProvider>
        </div>
      </main>
    </div>
  );
}
