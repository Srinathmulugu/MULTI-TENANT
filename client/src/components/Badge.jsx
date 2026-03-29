// Badge component
export function Badge({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
  };

  return (
    <span className={`badge ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
