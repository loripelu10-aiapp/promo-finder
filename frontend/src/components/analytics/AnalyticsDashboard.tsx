import React from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { StatsCard } from './StatsCard';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

export const AnalyticsDashboard: React.FC = () => {
  const { stats, loading, error } = useAnalytics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <LoadingSkeleton variant="card" count={4} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 text-gray-600">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-gray-400">Analytics data unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Analytics Dashboard</h2>
        <p className="text-gray-400">Real-time insights into deals and trends</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Deals"
          value={stats.totalDeals.toLocaleString()}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          }
          trend={{ value: 12.5, isPositive: true }}
        />

        <StatsCard
          title="Average Discount"
          value={`${stats.averageDiscount.toFixed(0)}%`}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
          trend={{ value: 3.2, isPositive: true }}
        />

        <StatsCard
          title="Top Brands"
          value={stats.topBrands.length}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          }
        />

        <StatsCard
          title="Categories"
          value={stats.categoryDistribution.length}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          }
        />
      </div>

      {/* Top Brands */}
      <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Top Brands by Deals</h3>
        <div className="space-y-3">
          {stats.topBrands.slice(0, 5).map((brand, index) => (
            <div key={brand.brand} className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-500 bg-opacity-20 rounded-lg text-orange-500 font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium">{brand.brand}</span>
                  <span className="text-gray-400 text-sm">
                    {brand.count} deals • Avg {brand.averageDiscount.toFixed(0)}% off
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                    style={{
                      width: `${(brand.count / stats.topBrands[0].count) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Deals by Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.categoryDistribution.map((cat) => (
            <div
              key={cat.category}
              className="bg-gray-900 bg-opacity-50 rounded-lg p-4 text-center"
            >
              <div className="text-3xl font-bold text-orange-500 mb-1">
                {cat.percentage.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400 capitalize">{cat.category}</div>
              <div className="text-xs text-gray-500 mt-1">{cat.count} deals</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
