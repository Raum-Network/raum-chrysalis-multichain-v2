import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  className = '',
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  type = 'button',
  icon
}) => {
  const variantClasses = {
    primary: 'bg-amber-700 hover:bg-amber-600 text-beige-100 border-amber-800',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-beige-100 border-gray-800',
    danger: 'bg-red-700 hover:bg-red-600 text-beige-100 border-red-800',
    success: 'bg-green-700 hover:bg-green-600 text-beige-100 border-green-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <motion.button
      onClick={onClick}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        flex items-center justify-center font-medium rounded-md 
        border transition-all focus:outline-none 
        active:translate-y-px active:shadow-none
        ${className}
      `}
      disabled={disabled}
      type={type}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </motion.button>
  );
};

export default Button;