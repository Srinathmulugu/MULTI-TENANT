import { Link, useLocation } from 'react-router-dom';

// Sidebar component
export function Sidebar({
  logo,
  navigation,
  secondaryNavigation,
  user,
  onLogout,
}) {
  const location = useLocation();

  return (
    <div className="hidden md:flex flex-col h-screen w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 overflow-y-auto">
      {/* Logo */}
      {logo && (
        <div className="p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600 text-white font-bold">
              {logo.icon || logo.text?.[0]}
            </div>
            <div>
              <h1 className="font-bold text-lg">{logo.text}</h1>
              {logo.subtitle && (
                <p className="text-xs text-dark-500 dark:text-dark-400">{logo.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4">
        {navigation && (
          <div className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Secondary Navigation */}
      {secondaryNavigation && (
        <nav className="p-4 border-t border-dark-200 dark:border-dark-700 space-y-2">
          {secondaryNavigation.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-all"
            >
              {item.icon && <item.icon className="w-5 h-5" />}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* User Section */}
      {user && (
        <div className="p-4 border-t border-dark-200 dark:border-dark-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold">
              {user.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{user.email}</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
            >
              Logout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Main Layout wrapper
export function DashboardLayout({
  sidebar,
  children,
  topbar: Topbar,
}) {
  return (
    <div className="flex h-screen bg-dark-50 dark:bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar {...sidebar} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        {Topbar && (
          <div className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 h-16">
            <Topbar />
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
