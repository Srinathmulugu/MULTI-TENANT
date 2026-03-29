// Card component
export function Card({
  children,
  title,
  subtitle,
  glass = false,
  hover = true,
  className = '',
  Actions,
  ...props
}) {
  const cardClass = `card ${glass ? 'card-glass' : ''} ${hover ? 'hover:shadow-md' : ''} p-6 ${className}`;

  return (
    <div className={cardClass} {...props}>
      <div className="flex items-start justify-between mb-4">
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {Actions && <Actions />}
      </div>
      {children}
    </div>
  );
}
