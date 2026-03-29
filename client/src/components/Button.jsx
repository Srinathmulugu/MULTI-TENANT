// Button component with variants
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };

  const sizes = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  const baseClass = `btn ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  return (
    <button
      className={baseClass}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
