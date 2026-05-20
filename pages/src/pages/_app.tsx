import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function GlobalLayout() {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const showAdminMenu = isAuthenticated && user?.admin === true;

  return (
    <>
      {/* Admin silver menu (above header), visible only to admins */}
      {showAdminMenu ? (
        <div className="bg-gray-100 border-b border-gray-200 text-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Admin
                </span>

                <nav className="flex items-center gap-2">
                  <Link
                    to="/admin/users"
                    className="text-sm font-medium px-2 py-1 rounded hover:text-gray-900 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    Users
                  </Link>
                  <Link
                    to="/admin/orders"
                    className="text-sm font-medium px-2 py-1 rounded hover:text-gray-900 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    Orders
                  </Link>
                  <Link
                    to="/admin/products"
                    className="text-sm font-medium px-2 py-1 rounded hover:text-gray-900 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    Products
                  </Link>
                </nav>
              </div>

              <span className="text-xs text-gray-500 truncate" aria-hidden="true">
                {user?.id}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              <Link to="/" className="text-indigo-600 hover:text-indigo-700">
                Cloudshop
              </Link>
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
