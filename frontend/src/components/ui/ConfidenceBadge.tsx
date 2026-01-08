import React from 'react';
import clsx from 'clsx';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
  showLabel?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  className,
  showLabel = true
}) => {
  const getColor = () => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getLabel = () => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    return 'Low';
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-2 py-1 rounded-md bg-black bg-opacity-50 text-xs font-medium',
        className
      )}
      title={`Confidence: ${score}%`}
    >
      <div className="flex items-center gap-1">
        <div className={clsx('w-2 h-2 rounded-full', getColor())} />
        <span className="text-white">{score}%</span>
      </div>
      {showLabel && (
        <span className="text-gray-300">{getLabel()}</span>
      )}
    </div>
  );
};
