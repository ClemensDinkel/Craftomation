interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const variants = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-100',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
  full: 'w-full py-4 text-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
