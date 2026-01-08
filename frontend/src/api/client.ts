import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ApiResponse, DealsResponse, AnalyticsStats, DealsFilters } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] Response from ${response.config.url}:`, response.status);
        return response;
      },
      (error: AxiosError) => {
        console.error('[API] Response error:', error.message);

        if (error.response) {
          // Server responded with error
          console.error('[API] Error details:', {
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          // Request made but no response
          console.error('[API] No response received');
        }

        return Promise.reject(error);
      }
    );
  }

  // Get deals with filters
  async getDeals(filters?: Partial<DealsFilters>, page = 1, limit = 50): Promise<DealsResponse> {
    try {
      const params = new URLSearchParams();

      // Region filter - most important for location-aware deals
      if (filters?.region) {
        params.append('region', filters.region);
      }

      if (filters?.searchQuery) params.append('search', filters.searchQuery);
      if (filters?.brands?.length) params.append('brand', filters.brands.join(','));
      if (filters?.categories?.length && !filters.categories.includes('all' as any)) {
        params.append('category', filters.categories.join(','));
      }
      if (filters?.minDiscount) params.append('minDiscount', filters.minDiscount.toString());
      if (filters?.priceRange?.max && filters.priceRange.max < 500) {
        params.append('maxPrice', filters.priceRange.max.toString());
      }
      if (filters?.priceRange?.min && filters.priceRange.min > 0) {
        params.append('minPrice', filters.priceRange.min.toString());
      }
      if (filters?.sources?.length) {
        params.append('source', filters.sources.join(','));
      }
      if (filters?.sortBy && filters.sortBy !== 'relevance') {
        params.append('sortBy', filters.sortBy);
      }
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      params.append('limit', limit.toString());

      const response = await this.client.get(`/api/deals?${params.toString()}`);

      if (response.data.success) {
        // Normalize the product data from API
        const deals = (response.data.deals || []).map((deal: any) => ({
          ...deal,
          // Normalize field names
          discount: deal.discount || deal.discountPercentage,
          discountPercentage: deal.discountPercentage || deal.discount,
          image: deal.image || deal.imageUrl,
          imageUrl: deal.imageUrl || deal.image,
          url: deal.url || deal.productUrl,
          productUrl: deal.productUrl || deal.url,
          regions: deal.regions || deal.availableRegions || [],
          availableRegions: deal.availableRegions || deal.regions || []
        }));

        return {
          deals,
          total: response.data.count || response.data.total || deals.length,
          page,
          limit,
          lastUpdated: new Date(response.data.lastUpdated || Date.now())
        };
      }

      throw new Error(response.data.message || 'Failed to fetch deals');
    } catch (error) {
      console.error('Error fetching deals:', error);
      throw error;
    }
  }

  // Get single deal by ID
  async getDeal(id: string) {
    try {
      const response = await this.client.get(`/api/deals/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching deal ${id}:`, error);
      throw error;
    }
  }

  // Get analytics/stats
  async getStats(region?: string): Promise<AnalyticsStats> {
    try {
      const params = new URLSearchParams();
      if (region) params.append('region', region);

      const response = await this.client.get(`/api/deals/stats?${params.toString()}`);

      // API returns stats directly, not wrapped in data.stats
      return {
        totalDeals: response.data.totalDeals || 0,
        averageDiscount: response.data.avgDiscount || response.data.averageDiscount || 0,
        topBrands: [],
        categoryDistribution: [],
        priceDistribution: [],
        recentActivity: []
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  // Get available regions
  async getRegions(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/deals/regions');

      if (response.data.success) {
        return response.data.regions || [];
      }

      throw new Error(response.data.message || 'Failed to fetch regions');
    } catch (error) {
      console.error('Error fetching regions:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const api = new ApiClient();
export default api;
