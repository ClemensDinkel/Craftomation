interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} border-2 border-gray-600 border-t-indigo-500 rounded-full animate-spin`}
    />
  );
}
