import React, { useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SearchBar } from './components/deals/SearchBar';
import { SortControls } from './components/deals/SortControls';
import { FilterPanel } from './components/deals/FilterPanel';
import { ProductGrid } from './components/deals/ProductGrid';
import { DealsBanner } from './components/deals/DealsBanner';
import { Pagination } from './components/ui/Pagination';
import { ToastContainer } from './components/ui/Toast';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { DealsProvider, useDealsContext } from './context/DealsContext';
import { useSearch } from './hooks/useSearch';
import { usePagination } from './hooks/usePagination';
import { useToast } from './hooks/useToast';
import type { Product } from './types';

// Lazy load analytics dashboard
const AnalyticsDashboard = lazy(() =>
  import('./components/analytics/AnalyticsDashboard').then(module => ({
    default: module.AnalyticsDashboard
  }))
);

const DealsPage: React.FC = () => {
  const {
    deals,
    filters,
    isLoading,
    error,
    total,
    lastUpdated,
    updateFilters,
    resetFilters,
    setSearchQuery
  } = useDealsContext();

  const { toasts, removeToast, success, error: showError } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { query, setQuery } = useSearch((q) => {
    setSearchQuery(q);
  }, 300);

  const pagination = usePagination({
    totalItems: total,
    pageSize: 50,
    initialPage: 1
  });

  const handleViewDeal = (product: Product) => {
    window.open(product.url, '_blank', 'noopener,noreferrer');
    success(`Opening deal: ${product.name}`);
  };

  if (error) {
    showError(error.message);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 opacity-10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 opacity-10 blur-3xl rounded-full" />
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Discover Amazing Deals
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Real-time fashion deals from top brands. Save up to 80% on clothing, shoes, and accessories.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8 max-w-3xl mx-auto">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search for brands, products, or styles..."
            />
          </div>

          {/* Top Deals Banner */}
          {deals.length > 0 && !isLoading && (
            <div className="mb-8">
              <DealsBanner deals={deals} />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {showFilters && <span className="text-xs bg-orange-500 px-2 py-0.5 rounded-full">On</span>}
              </button>

              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </button>

              <div className="text-sm text-gray-400">
                <span className="font-bold text-orange-500">{total}</span> deals found
              </div>
            </div>

            <SortControls
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSortChange={(sortBy) => updateFilters({ sortBy })}
              onOrderChange={(sortOrder) => updateFilters({ sortOrder })}
            />
          </div>

          {/* Analytics Dashboard */}
          {showAnalytics && (
            <div className="mb-8">
              <Suspense fallback={<LoadingSkeleton variant="card" count={4} />}>
                <AnalyticsDashboard />
              </Suspense>
            </div>
          )}

          {/* Filters + Products Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-20">
                  <FilterPanel
                    filters={filters}
                    onFilterChange={updateFilters}
                    onReset={resetFilters}
                    isOpen={showFilters}
                  />
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <ProductGrid
                products={deals}
                loading={isLoading}
                onViewDeal={handleViewDeal}
                emptyMessage="No deals found. Try adjusting your filters or search query."
              />

              {/* Pagination */}
              {!isLoading && total > pagination.pageSize && (
                <div className="mt-8">
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.goToPage}
                    pageSize={pagination.pageSize}
                    totalItems={total}
                  />
                </div>
              )}

              {/* Last Updated */}
              {lastUpdated && !isLoading && (
                <div className="text-center mt-8 text-sm text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DealsProvider>
        <DealsPage />
      </DealsProvider>
    </ErrorBoundary>
  );
};

export default App;
