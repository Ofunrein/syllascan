'use client';
import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (guests: string[]) => void;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function GuestsInput({ value, onChange }: Props) {
  const [input, setInput] = useState('');

  const add = () => {
    const email = input.trim().toLowerCase();
    if (isValidEmail(email) && !value.includes(email)) {
      onChange([...value, email]);
    }
    setInput('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded border border-white/20 bg-white/5 min-h-[40px] focus-within:border-blue-500">
      {value.map(email => (
        <span key={email} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs">
          {email}
          <button type="button" onClick={() => onChange(value.filter(e => e !== email))}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        type="email"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={value.length ? '' : 'Add guests...'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-white/30 outline-none"
      />
    </div>
  );
}
