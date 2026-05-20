import React, { useId, useState } from 'react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 2l20 20" />
      <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" />
      <path d="M9.88 5.09A10.93 10.93 0 0 1 12 5c7 0 11 7 11 7a21.8 21.8 0 0 1-5.08 6.32" />
      <path d="M6.22 6.22A21.8 21.8 0 0 0 1 12s4 7 11 7c1.05 0 2.06-.2 3-.56" />
      <path d="M14.12 14.12A3 3 0 0 0 12 9a3 3 0 0 0-2.12.88" />
    </svg>
  );
}

export default function PasswordInput(props: PasswordInputProps) {
  const id = props.id ?? useId();
  const [visible, setVisible] = useState(false);

  const {
    className,
    autoComplete,
    onChange,
    value,
    disabled,
    required,
    ...restProps
  } = props;

  return (
    <div className="relative">
      <input
        id={id}
        {...restProps}
        className={[
          className ?? '',
          'mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
          'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500',
          'pr-10',
          disabled ? 'bg-gray-50 cursor-not-allowed' : '',
        ].join(' ')}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete ?? 'current-password'}
        onChange={onChange}
        value={value}
        disabled={disabled}
        required={required}
      />

      <button
        type="button"
        className={[
          'absolute inset-y-0 right-0 flex items-center pr-3',
          'text-gray-500 hover:text-gray-700',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={disabled}
      >
        <span className="h-5 w-5">
          <EyeIcon visible={visible} />
        </span>
      </button>
    </div>
  );
}
