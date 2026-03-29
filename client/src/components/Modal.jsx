import { motion, AnimatePresence } from 'framer-motion';

// Modal component
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={`modal ${sizes[size]} w-full mx-4 ${className}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="p-6">
              {title && (
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
              )}
              <div className="mb-6">
                {children}
              </div>
              {actions && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-200 dark:border-dark-700">
                  {actions}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
