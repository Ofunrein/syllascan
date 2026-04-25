'use client';

import { useAuth } from '@/components/AuthProvider';

export default function GoogleUserProfile() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="h-4 w-24 rounded bg-white/10" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex items-center gap-3">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name || ''}
          className="w-8 h-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
          {(profile.display_name || profile.email)?.[0]?.toUpperCase()}
        </div>
      )}
      <span className="text-white/80 text-sm">{profile.display_name || profile.email}</span>
    </div>
  );
}
