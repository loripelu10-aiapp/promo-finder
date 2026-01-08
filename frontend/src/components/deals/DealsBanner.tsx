import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import type { Product } from '../../types';

interface DealsBannerProps {
  deals: Product[];
  autoplay?: boolean;
  interval?: number;
}

export const DealsBanner: React.FC<DealsBannerProps> = ({
  deals,
  autoplay = true,
  interval = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const topDeals = deals
    .filter(deal => deal.discountPercentage >= 50)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)
    .slice(0, 5);

  useEffect(() => {
    if (!autoplay || topDeals.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % topDeals.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoplay, interval, topDeals.length]);

  if (topDeals.length === 0) return null;

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + topDeals.length) % topDeals.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % topDeals.length);
  };

  return (
    <div className="relative bg-gradient-to-r from-orange-900 to-red-900 rounded-2xl overflow-hidden">
      {/* Content */}
      <div className="relative h-64 md:h-80">
        {topDeals.map((deal, index) => (
          <div
            key={deal.id}
            className={clsx(
              'absolute inset-0 transition-opacity duration-500',
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="flex items-center h-full p-8 md:p-12">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white bg-opacity-20 rounded-full text-white text-sm font-bold">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  HOT DEAL
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  {deal.name}
                </h2>

                <div className="flex items-baseline gap-3">
                  <span className="text-4xl md:text-5xl font-bold text-white">
                    €{deal.salePrice.toFixed(2)}
                  </span>
                  <span className="text-2xl text-white text-opacity-60 line-through">
                    €{deal.originalPrice.toFixed(2)}
                  </span>
                  <span className="px-3 py-1 bg-yellow-400 text-black text-xl font-bold rounded-lg">
                    -{deal.discountPercentage}%
                  </span>
                </div>

                <p className="text-white text-opacity-80">
                  {deal.brand} • {deal.source}
                </p>

                <a
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Grab This Deal
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>

              {/* Image */}
              <div className="hidden md:block flex-shrink-0 w-64 h-64 ml-8">
                <img
                  src={deal.image}
                  alt={deal.name}
                  className="w-full h-full object-cover rounded-xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      {topDeals.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
            aria-label="Previous deal"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
            aria-label="Next deal"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {topDeals.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={clsx(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentIndex
                    ? 'w-8 bg-white'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
