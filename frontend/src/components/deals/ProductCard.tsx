import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Product } from '../../types';
import { DiscountBadge } from '../ui/DiscountBadge';
import { formatPrice } from '../../utils/regionDetection';

interface ProductCardProps {
  product: Product;
  onViewDeal?: (product: Product) => void;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewDeal,
  index = 0
}) => {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleViewDeal = () => {
    if (onViewDeal) {
      onViewDeal(product);
    } else {
      const url = product.affiliateUrl || product.url || product.productUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Get retailer name
  const retailerName = product.retailer || product.merchantName || product.brand || 'Unknown';

  // Get discount percentage
  const discountPercent = product.discountPercentage || product.discount || 0;

  return (
    <div
      className={clsx(
        'bg-gray-800 bg-opacity-30 rounded-2xl overflow-hidden border border-gray-700',
        'hover:border-orange-500 hover:shadow-2xl hover:-translate-y-2',
        'transition-all duration-300 group',
        'animate-in fade-in slide-in-from-bottom-4'
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-gray-900 overflow-hidden">
        {!imageError ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={clsx(
              'w-full h-full object-cover transition-all duration-500',
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
              'group-hover:scale-110'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-600">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3">
          <DiscountBadge percentage={discountPercent} />
        </div>

        {/* Smart Badges - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {product.bestValue && (
            <div className="px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded-md flex items-center gap-1">
              <span>Best Value</span>
            </div>
          )}
          {product.topDeal && !product.bestValue && (
            <div className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-md">
              Top Deal
            </div>
          )}
          {product.priceDrop && (
            <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-md">
              Price Drop
            </div>
          )}
        </div>

        {/* Gender Badge - Bottom Left */}
        {product.gender && product.gender !== 'unisex' && (
          <div className="absolute bottom-3 left-3">
            <span className={clsx(
              'px-2 py-1 text-xs font-medium rounded-md',
              product.gender === 'men' && 'bg-blue-500/80 text-white',
              product.gender === 'women' && 'bg-pink-500/80 text-white',
              product.gender === 'kids' && 'bg-purple-500/80 text-white'
            )}>
              {product.gender === 'men' ? 'Men' : product.gender === 'women' ? 'Women' : 'Kids'}
            </span>
          </div>
        )}

        {/* Overlay */}
        <div
          className={clsx(
            'absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent',
            'flex items-center justify-center',
            'transition-opacity duration-300',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <button
            onClick={handleViewDeal}
            className={clsx(
              'px-6 py-3 bg-white text-black rounded-xl font-bold',
              'flex items-center gap-2 transition-transform duration-300',
              isHovered ? 'translate-y-0' : 'translate-y-4'
            )}
          >
            View Deal
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-2">
        {/* Brand */}
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {product.brand}
        </div>

        {/* Product Name */}
        <h3 className="text-base font-semibold text-white line-clamp-2 min-h-[3rem]">
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-orange-500">
            {formatPrice(product.salePrice, product.currency)}
          </span>
          <span className="text-sm text-gray-500 line-through">
            {formatPrice(product.originalPrice, product.currency)}
          </span>
        </div>

        {/* Retailer Name */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-sm font-medium text-gray-300">{retailerName}</span>
          </div>
          {product.dealScore && product.dealScore >= 70 && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{product.dealScore}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
