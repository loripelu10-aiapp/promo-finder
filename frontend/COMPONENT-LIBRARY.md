# PromoFinder Component Library

## Table of Contents
1. [UI Components](#ui-components)
2. [Deals Components](#deals-components)
3. [Analytics Components](#analytics-components)
4. [Layout Components](#layout-components)
5. [Hooks](#hooks)
6. [Context](#context)

---

## UI Components

### DiscountBadge

Visual badge showing discount percentage with color coding.

```typescript
interface DiscountBadgeProps {
  percentage: number;
  className?: string;
}
```

**Example:**
```tsx
<DiscountBadge percentage={50} />
```

**Color Coding:**
- Red (50%+): Hot deals
- Orange (30-49%): Medium deals
- Blue (<30%): Regular deals

---

### ConfidenceBadge

Display product confidence score with visual indicator.

```typescript
interface ConfidenceBadgeProps {
  score: number;        // 70-99
  className?: string;
  showLabel?: boolean;  // default: true
}
```

**Example:**
```tsx
<ConfidenceBadge score={95} showLabel={true} />
```

**Levels:**
- Green (90+): Excellent
- Blue (80-89): Good
- Yellow (70-79): Fair
- Gray (<70): Low

---

### LoadingSkeleton

Placeholder for loading content.

```typescript
interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'circle' | 'rect';
  count?: number;
  className?: string;
}
```

**Example:**
```tsx
<LoadingSkeleton variant="card" count={4} />
<ProductCardSkeleton /> // Specialized skeleton
```

---

### Toast

Notification system for user feedback.

```typescript
interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number; // milliseconds
}
```

**Example:**
```tsx
// Using hook
const { success, error, warning, info } = useToast();

success('Deal saved!');
error('Failed to load deals');
warning('Connection unstable');
info('New deals available');

// Manual
<ToastContainer toasts={toasts} onClose={removeToast} />
```

---

### Modal

Reusable modal dialog.

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
```

**Example:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Deal Details"
  size="lg"
>
  <p>Modal content here</p>
</Modal>
```

**Features:**
- Backdrop blur
- Escape key to close
- Click outside to close
- Scroll lock
- Animations

---

### Tooltip

Hover tooltip for additional information.

```typescript
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}
```

**Example:**
```tsx
<Tooltip content="Click to view deal" position="top">
  <button>View Deal</button>
</Tooltip>
```

---

### Pagination

Smart pagination component.

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}
```

**Example:**
```tsx
<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={(page) => console.log(page)}
  pageSize={50}
  totalItems={500}
/>
```

---

### ErrorBoundary

Catch and display React errors.

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
```

**Example:**
```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary fallback={<CustomError />}>
  <Component />
</ErrorBoundary>
```

---

## Deals Components

### SearchBar

Real-time search with debouncing.

```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  className?: string;
}
```

**Example:**
```tsx
const { query, setQuery } = useSearch(onSearch, 300);

<SearchBar
  value={query}
  onChange={setQuery}
  placeholder="Search brands..."
/>
```

**Features:**
- Keyboard shortcut (⌘K)
- Clear button
- Debouncing (300ms)
- Icon indicators

---

### SortControls

Sort options for products.

```typescript
interface SortControlsProps {
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: SortOption) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

type SortOption = 'price' | 'discount' | 'popularity' | 'date' | 'relevance';
```

**Example:**
```tsx
<SortControls
  sortBy="discount"
  sortOrder="desc"
  onSortChange={(sortBy) => updateFilters({ sortBy })}
  onOrderChange={(sortOrder) => updateFilters({ sortOrder })}
/>
```

---

### ProductCard

Enhanced product display card.

```typescript
interface ProductCardProps {
  product: Product;
  onViewDeal?: (product: Product) => void;
  index?: number;
}
```

**Example:**
```tsx
<ProductCard
  product={product}
  onViewDeal={(p) => window.open(p.url, '_blank')}
  index={0}
/>
```

**Features:**
- Lazy-loaded images
- Discount badge
- Confidence score
- Hover overlay
- Animation delays
- Error fallback

---

### ProductGrid

Responsive grid for products.

```typescript
interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  onViewDeal?: (product: Product) => void;
  className?: string;
  emptyMessage?: string;
}
```

**Example:**
```tsx
<ProductGrid
  products={deals}
  loading={isLoading}
  onViewDeal={handleViewDeal}
  emptyMessage="No deals found"
/>
```

**Layout:**
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Large: 4 columns

---

### FilterPanel

Comprehensive filtering interface.

```typescript
interface FilterPanelProps {
  filters: DealsFilters;
  onFilterChange: (filters: Partial<DealsFilters>) => void;
  onReset: () => void;
  className?: string;
  isOpen?: boolean;
}
```

**Example:**
```tsx
<FilterPanel
  filters={filters}
  onFilterChange={updateFilters}
  onReset={resetFilters}
  isOpen={showFilters}
/>
```

**Includes:**
- Category filter
- Brand filter
- Price range
- Discount filter
- Active filters summary

---

### DealsBanner

Carousel for top deals.

```typescript
interface DealsBannerProps {
  deals: Product[];
  autoplay?: boolean;
  interval?: number; // milliseconds
}
```

**Example:**
```tsx
<DealsBanner
  deals={topDeals}
  autoplay={true}
  interval={5000}
/>
```

**Features:**
- Auto-play
- Manual navigation
- Dot indicators
- Responsive layout
- Shows 50%+ deals only

---

## Filter Components

### PriceRangeSlider

Dual slider for price range.

```typescript
interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  className?: string;
}
```

**Example:**
```tsx
<PriceRangeSlider
  min={0}
  max={500}
  value={priceRange}
  onChange={setPriceRange}
/>
```

---

### CategoryFilter

Multi-select category filter.

```typescript
interface CategoryFilterProps {
  selected: ProductCategory[];
  onChange: (categories: ProductCategory[]) => void;
  className?: string;
}
```

**Example:**
```tsx
<CategoryFilter
  selected={selectedCategories}
  onChange={setSelectedCategories}
/>
```

---

### BrandFilter

Brand selection with search.

```typescript
interface BrandFilterProps {
  selected: string[];
  onChange: (brands: string[]) => void;
  className?: string;
}
```

**Example:**
```tsx
<BrandFilter
  selected={selectedBrands}
  onChange={setSelectedBrands}
/>
```

**Features:**
- Search brands
- Multi-select
- Clear all button
- Scrollable list

---

### DiscountFilter

Minimum discount slider.

```typescript
interface DiscountFilterProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}
```

**Example:**
```tsx
<DiscountFilter
  value={minDiscount}
  onChange={setMinDiscount}
/>
```

---

## Analytics Components

### AnalyticsDashboard

Complete analytics dashboard.

```typescript
// No props - uses useAnalytics hook internally
```

**Example:**
```tsx
<AnalyticsDashboard />
```

**Displays:**
- Total deals
- Average discount
- Top brands
- Category distribution
- Charts and graphs

---

### StatsCard

Individual stat display.

```typescript
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
```

**Example:**
```tsx
<StatsCard
  title="Total Deals"
  value={1234}
  icon={<TagIcon />}
  trend={{ value: 12.5, isPositive: true }}
/>
```

---

## Layout Components

### Header

Application header with navigation.

```typescript
interface HeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}
```

**Example:**
```tsx
<Header
  onMenuClick={() => setMenuOpen(true)}
  showMenu={true}
/>
```

**Features:**
- Logo
- Navigation links
- Language selector
- Mobile menu button

---

### Footer

Application footer.

```typescript
// No props
```

**Example:**
```tsx
<Footer />
```

**Includes:**
- Brand info
- Quick links
- Social links
- Copyright

---

## Hooks

### useDeals

Fetch and manage deals.

```typescript
function useDeals(
  filters?: Partial<DealsFilters>,
  page?: number,
  limit?: number
): {
  deals: Product[];
  loading: boolean;
  error: Error | null;
  total: number;
  lastUpdated: Date | null;
  refreshDeals: () => Promise<void>;
}
```

**Example:**
```tsx
const { deals, loading, error, refreshDeals } = useDeals(filters, 1, 50);
```

---

### useSearch

Search with debouncing.

```typescript
function useSearch(
  onSearch?: (query: string) => void,
  debounceMs?: number
): {
  query: string;
  debouncedQuery: string;
  setQuery: (query: string) => void;
  clearQuery: () => void;
}
```

**Example:**
```tsx
const { query, debouncedQuery, setQuery } = useSearch(handleSearch, 300);
```

---

### useFilters

Filter state management.

```typescript
function useFilters(initialFilters?: Partial<DealsFilters>): {
  filters: DealsFilters;
  updateFilters: (newFilters: Partial<DealsFilters>) => void;
  resetFilters: () => void;
  setFilter: <K extends keyof DealsFilters>(key: K, value: DealsFilters[K]) => void;
}
```

**Example:**
```tsx
const { filters, updateFilters, resetFilters } = useFilters();
```

---

### usePagination

Pagination logic.

```typescript
function usePagination({
  totalItems,
  pageSize,
  initialPage
}: UsePaginationProps): {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  offset: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  resetPagination: () => void;
}
```

**Example:**
```tsx
const pagination = usePagination({
  totalItems: 100,
  pageSize: 50,
  initialPage: 1
});
```

---

### useToast

Toast notifications.

```typescript
function useToast(): {
  toasts: ToastMessage[];
  showToast: (message: string, type: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}
```

**Example:**
```tsx
const { success, error } = useToast();

success('Saved successfully!');
error('Something went wrong');
```

---

### useAnalytics

Analytics data.

```typescript
function useAnalytics(): {
  stats: AnalyticsStats | null;
  loading: boolean;
  error: Error | null;
  refreshStats: () => Promise<void>;
}
```

**Example:**
```tsx
const { stats, loading, error } = useAnalytics();
```

---

## Context

### DealsContext

Global deals state management.

```typescript
interface DealsContextValue {
  deals: Product[];
  filters: DealsFilters;
  isLoading: boolean;
  error: Error | null;
  total: number;
  lastUpdated: Date | null;
  updateFilters: (filters: Partial<DealsFilters>) => void;
  resetFilters: () => void;
  refreshDeals: () => Promise<void>;
  setSearchQuery: (query: string) => void;
}
```

**Example:**
```tsx
// Provider
<DealsProvider>
  <App />
</DealsProvider>

// Consumer
const { deals, filters, updateFilters } = useDealsContext();
```

---

## Utilities

### API Client

```typescript
// Fetch deals
const response = await api.getDeals(filters, page, limit);

// Get single deal
const deal = await api.getDeal(id);

// Get analytics
const stats = await api.getStats();

// Health check
const isHealthy = await api.healthCheck();
```

---

## Best Practices

### Performance
- Use `React.memo()` for expensive components
- Implement `useCallback()` for function props
- Use `useMemo()` for computed values
- Lazy load heavy components
- Debounce user input

### Accessibility
- Always include ARIA labels
- Support keyboard navigation
- Maintain focus management
- Use semantic HTML
- Ensure color contrast

### TypeScript
- Define all prop types
- Use strict mode
- Avoid `any` type
- Export types for reuse

### Styling
- Use Tailwind utilities
- Follow mobile-first approach
- Maintain consistent spacing
- Use design system colors

---

## Support

For issues or questions, contact the development team or refer to the main documentation.
