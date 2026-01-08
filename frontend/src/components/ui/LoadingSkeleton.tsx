import React from 'react';
import clsx from 'clsx';

interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'circle' | 'rect';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'rect',
  count = 1,
  className
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  const baseClass = 'animate-pulse bg-gray-700';

  const variantClass = {
    card: 'h-96 rounded-2xl',
    text: 'h-4 rounded',
    circle: 'w-12 h-12 rounded-full',
    rect: 'h-24 rounded-lg'
  };

  return (
    <>
      {skeletons.map((i) => (
        <div
          key={i}
          className={clsx(baseClass, variantClass[variant], className)}
        />
      ))}
    </>
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-gray-800 bg-opacity-30 rounded-2xl overflow-hidden border border-gray-700">
      <div className="animate-pulse">
        <div className="aspect-square bg-gray-700" />
        <div className="p-4 space-y-3">
          <div className="h-3 bg-gray-700 rounded w-1/4" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="flex gap-2">
            <div className="h-6 bg-gray-700 rounded w-1/3" />
            <div className="h-6 bg-gray-700 rounded w-1/4" />
          </div>
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
};
