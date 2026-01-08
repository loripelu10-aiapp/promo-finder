import React from 'react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  className
}) => {
  return (
    <div
      className={clsx(
        'bg-gray-800 bg-opacity-50 border border-gray-700 rounded-xl p-6',
        'hover:border-orange-500 transition-all duration-300',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-2">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>

          {trend && (
            <div
              className={clsx(
                'flex items-center gap-1 mt-2 text-sm font-medium',
                trend.isPositive ? 'text-green-400' : 'text-red-400'
              )}
            >
              {trend.isPositive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 p-3 bg-orange-500 bg-opacity-20 rounded-lg">
          <div className="w-6 h-6 text-orange-500">{icon}</div>
        </div>
      </div>
    </div>
  );
};
