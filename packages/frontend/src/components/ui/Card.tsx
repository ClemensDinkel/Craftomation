interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}
