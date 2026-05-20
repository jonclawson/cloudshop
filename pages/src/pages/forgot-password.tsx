import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

type ForgotPasswordResponse = {
  message?: string;
  error?: string;
  reset_token?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setStatus('');
    setDevResetToken(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | ForgotPasswordResponse
        | undefined;

      if (!response.ok) {
        setError(data?.error || 'Failed to request password reset');
        return;
      }

      setStatus(data?.message || 'If your email exists, you will receive a reset link.');
      if (data?.reset_token) {
        setDevResetToken(data.reset_token);
      }
    } catch {
      setError('Network error while requesting password reset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Forgot Password</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {status && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-800 rounded">
            <div>{status}</div>

            {devResetToken ? (
              <div className="mt-3">
                <div className="text-sm font-semibold">Dev reset link:</div>
                <a
                  href={`/reset-password?token=${encodeURIComponent(devResetToken)}`}
                  className="text-sm text-green-900 underline hover:text-green-700 break-all"
                >
                  /reset-password?token={devResetToken}
                </a>
              </div>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-indigo-600 hover:text-indigo-700">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
