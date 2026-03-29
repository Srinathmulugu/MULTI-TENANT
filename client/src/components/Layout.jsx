// Container/Layout component
export function Container({
  children,
  maxWidth = 'max-w-7xl',
  centered = false,
  className = '',
  ...props
}) {
  return (
    <div
      className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 ${centered ? 'py-8 sm:py-12' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Page header component
export function PageHeader({
  title,
  description,
  actions: Actions,
  breadcrumbs,
  className = '',
}) {
  return (
    <div className={`mb-8 ${className}`}>
      {breadcrumbs && (
        <nav className="flex items-center gap-2 mb-4 text-sm">
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-dark-400">/</span>}
              {breadcrumb.href ? (
                <a href={breadcrumb.href} className="text-primary-600 hover:text-primary-700">
                  {breadcrumb.label}
                </a>
              ) : (
                <span className="text-dark-600">{breadcrumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {description && <p className="text-dark-600 dark:text-dark-400">{description}</p>}
        </div>
        {Actions && <Actions />}
      </div>
    </div>
  );
}
