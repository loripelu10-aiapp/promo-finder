import React from 'react';
import clsx from 'clsx';

interface DiscountBadgeProps {
  percentage: number;
  className?: string;
}

export const DiscountBadge: React.FC<DiscountBadgeProps> = ({
  percentage,
  className
}) => {
  const isHot = percentage >= 50;
  const isMedium = percentage >= 30 && percentage < 50;

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-bold text-sm',
        {
          'bg-gradient-to-r from-red-600 to-red-700 text-white animate-pulse': isHot,
          'bg-gradient-to-r from-orange-500 to-orange-600 text-white': isMedium,
          'bg-gradient-to-r from-blue-500 to-blue-600 text-white': !isHot && !isMedium
        },
        className
      )}
    >
      -{percentage}% OFF
    </div>
  );
};
