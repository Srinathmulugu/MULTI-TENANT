// Alert component
export function Alert({
  children,
  variant = 'info',
  title,
  icon: Icon,
  className = '',
  ...props
}) {
  const variants = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
  };

  return (
    <div className={`alert ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        {children}
      </div>
    </div>
  );
}
