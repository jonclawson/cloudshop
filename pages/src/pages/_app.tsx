import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function GlobalLayout() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              <Link to="/" className="text-indigo-600 hover:text-indigo-700">Cloudshop</Link>
            </h1>
            <nav className="flex space-x-4">
              {isAuthenticated ? (
                <>
                  <a href="/" className="text-gray-700 hover:text-gray-900">
                    Shop
                  </a>
                  <a href="/orders" className="text-gray-700 hover:text-gray-900">
                    Orders
                  </a>
                  <a href="/cart" className="text-gray-700 hover:text-gray-900">
                    Cart
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      navigate('/login', { replace: true });
                    }}
                    className="text-gray-700 hover:text-gray-900"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <a href="/login" className="text-gray-700 hover:text-gray-900">
                  Login
                </a>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Active route content */}
      <main className="min-h-screen max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Shared footer */}
      <footer className="border-t border-slate-800 bg-slate-950 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center">
          &copy; {new Date().getFullYear()} My Store Inc. All rights reserved.
        </div>
      </footer>
    </>
  );
}
