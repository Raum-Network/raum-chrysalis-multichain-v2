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
    primary: 'bg-[rgb(var(--ink-strong))] text-white hover:bg-[rgb(var(--accent-strong))] shadow-[0_18px_36px_rgba(15,23,42,0.14)]',
    secondary: 'premium-card hover:border-[rgba(var(--accent),0.24)]',
    danger: 'bg-[rgb(var(--danger))] text-white hover:bg-red-700 shadow-[0_18px_36px_rgba(194,77,77,0.22)]',
    success: 'bg-[rgb(var(--success))] text-white hover:bg-emerald-700 shadow-[0_18px_36px_rgba(39,161,122,0.22)]',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <motion.button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent),0.24)] ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
      disabled={disabled}
      type={type}
      whileHover={!disabled ? { y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.button>
  );
};

export default Button;
