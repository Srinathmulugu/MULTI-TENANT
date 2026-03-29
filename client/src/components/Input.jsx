// Input component with variants
export function Input({
  type = 'text',
  label,
  error,
  success,
  placeholder,
  className = '',
  icon: Icon,
  required,
  ...props
}) {
  const inputClass = `input ${
    error ? 'input-error' : success ? 'input-success' : ''
  } ${className}`;

  return (
    <div className="form-group">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 pointer-events-none" />
        )}
        <input
          type={type}
          placeholder={placeholder}
          className={`${inputClass} ${Icon ? 'pl-10' : ''}`}
          required={required}
          {...props}
        />
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {success && <p className="text-green-500 text-sm mt-1">{success}</p>}
    </div>
  );
}
