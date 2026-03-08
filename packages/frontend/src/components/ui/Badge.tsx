interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'red' | 'yellow' | 'gray';
  className?: string;
}

const colors = {
  green: 'bg-green-900/50 text-green-400',
  red: 'bg-red-900/50 text-red-400',
  yellow: 'bg-yellow-900/50 text-yellow-400',
  gray: 'bg-gray-700 text-gray-300',
};

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}
