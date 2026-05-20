import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../../useApi';
import { useAuth } from '../../../AuthContext';

type AdminUser = {
  id: string;
  email: string;
  admin: boolean;
  created_at?: string;
};

export default function AdminUsersPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createdAtText = useMemo(
    () =>
      (value: string | undefined) => {
        if (!value) return '—';
        return value;
      },
    []
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const run = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await adminApi.getUsers();
        setUsers((response.data.users as AdminUser[]) || []);
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
        setErrorMessage('Not authorized to view users.');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="main-class flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to view admin</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="main-class">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin - Users</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          Back home
        </button>
      </div>

      {errorMessage ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Login
          </a>
        </div>
      ) : loading ? (
        <p>Loading users…</p>
      ) : users.length === 0 ? (
        <div className="text-center border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">No users found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => navigate(`/admin/users/${user.id}`)}
              className="w-full border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{user.email}</p>
                  <p className="text-sm text-gray-600">{createdAtText(user.created_at)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'rounded-md border px-2 py-1 text-xs font-medium',
                      user.admin
                        ? 'border-green-400 bg-green-100 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700',
                    ].join(' ')}
                  >
                    {user.admin ? 'Admin' : 'User'}
                  </span>
                  <span className="text-sm text-indigo-700 font-medium">View →</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
