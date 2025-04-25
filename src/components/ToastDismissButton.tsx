'use client';

import { XMarkIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface ToastDismissButtonProps {
  className?: string;
}

export default function ToastDismissButton({ className = '' }: ToastDismissButtonProps) {
  const handleDismissAll = () => {
    toast.dismiss();
  };

  return (
    <button
      onClick={handleDismissAll}
      className={`fixed top-4 right-4 z-[10000] p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors ${className}`}
      aria-label="Dismiss all notifications"
    >
      <XMarkIcon className="h-5 w-5 text-gray-600" />
    </button>
  );
} 