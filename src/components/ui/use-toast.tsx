// Adapted from shadcn/ui toast component
import { useState, useEffect, createContext, useContext } from 'react'

type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

type ToastContextType = {
  toast: (props: ToastProps) => void
  dismiss: (id?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Record<string, ToastProps>>({})

  const toast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => ({ ...prev, [id]: props }))

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      dismiss(id)
    }, 3000)
  }

  const dismiss = (id?: string) => {
    if (id) {
      setToasts((prev) => {
        const newToasts = { ...prev }
        delete newToasts[id]
        return newToasts
      })
    } else {
      setToasts({})
    }
  }

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2 max-w-md">
        {Object.entries(toasts).map(([id, { title, description, variant }]) => (
          <div 
            key={id}
            className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border-l-4 ${
              variant === 'destructive' ? 'border-red-500' : 'border-blue-500'
            }`}
          >
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && <p className="text-sm opacity-90">{description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
} 