/**
 * Claude API Client
 *
 * Wrapper for Anthropic's Claude API for product verification
 * Uses Claude 3 Haiku for fast, cost-effective verification
 */

import axios, { AxiosInstance } from 'axios';
import {
  ClaudeApiConfig,
  ClaudeApiRequest,
  ClaudeApiResponse,
  ApiUsageLog
} from '../types';

/**
 * Claude API client class
 */
export class ClaudeClient {
  private config: ClaudeApiConfig;
  private axiosClient: AxiosInstance;
  private apiLogs: ApiUsageLog[] = [];

  constructor(config: Partial<ClaudeApiConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.CLAUDE_API_KEY || '',
      model: config.model || process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      maxTokens: config.maxTokens || parseInt(process.env.CLAUDE_MAX_TOKENS || '500', 10),
      temperature: config.temperature || parseFloat(process.env.CLAUDE_TEMPERATURE || '0.1'),
      timeout: config.timeout || 10000
    };

    if (!this.config.apiKey) {
      throw new Error('Claude API key is required. Set CLAUDE_API_KEY environment variable.');
    }

    this.axiosClient = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
  }

  /**
   * Send a message to Claude API
   *
   * @param prompt - The prompt to send
   * @param systemPrompt - Optional system prompt
   * @returns Claude API response
   */
  async sendMessage(
    prompt: string,
    systemPrompt?: string
  ): Promise<ClaudeApiResponse> {
    const startTime = Date.now();

    try {
      const request: Partial<ClaudeApiRequest> = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      // Add system prompt if provided (as a separate field in newer API versions)
      const requestBody = systemPrompt
        ? { ...request, system: systemPrompt }
        : request;

      const response = await this.axiosClient.post<ClaudeApiResponse>(
        '/messages',
        requestBody
      );

      const responseTime = Date.now() - startTime;

      // Log successful API call
      this.logApiCall({
        provider: 'claude',
        endpoint: '/messages',
        requestParams: { prompt: prompt.substring(0, 100) },
        responseStatus: response.status,
        responseTime,
        creditsUsed: response.data.usage.input_tokens + response.data.usage.output_tokens,
        estimatedCost: this.estimateCost(response.data.usage),
        success: true
      });

      return response.data;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Log failed API call
      this.logApiCall({
        provider: 'claude',
        endpoint: '/messages',
        requestParams: { prompt: prompt.substring(0, 100) },
        responseStatus: error.response?.status || 0,
        responseTime,
        creditsUsed: 0,
        success: false,
        errorMessage: error.message
      });

      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Extract text content from Claude response
   *
   * @param response - Claude API response
   * @returns Extracted text
   */
  extractTextContent(response: ClaudeApiResponse): string {
    if (!response.content || response.content.length === 0) {
      return '';
    }

    const textContent = response.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    return textContent;
  }

  /**
   * Parse JSON response from Claude
   *
   * @param response - Claude API response
   * @returns Parsed JSON object
   */
  parseJsonResponse<T>(response: ClaudeApiResponse): T {
    const text = this.extractTextContent(response);

    try {
      // Try to find JSON in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (error: any) {
      throw new Error(`Failed to parse JSON response: ${error.message}. Response: ${text}`);
    }
  }

  /**
   * Estimate cost of API call
   *
   * Pricing for Claude 3 Haiku (as of 2024):
   * - Input: $0.25 per million tokens
   * - Output: $1.25 per million tokens
   */
  private estimateCost(usage: { input_tokens: number; output_tokens: number }): number {
    const inputCost = (usage.input_tokens / 1_000_000) * 0.25;
    const outputCost = (usage.output_tokens / 1_000_000) * 1.25;
    return inputCost + outputCost;
  }

  /**
   * Log API call for tracking
   */
  private logApiCall(log: ApiUsageLog): void {
    this.apiLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.apiLogs.length > 1000) {
      this.apiLogs.shift();
    }
  }

  /**
   * Get API usage statistics
   */
  getUsageStats(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    averageResponseTime: number;
  } {
    const totalCalls = this.apiLogs.length;
    const successfulCalls = this.apiLogs.filter(l => l.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const totalCost = this.apiLogs.reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
    const averageResponseTime = totalCalls > 0
      ? this.apiLogs.reduce((sum, l) => sum + l.responseTime, 0) / totalCalls
      : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalCost,
      averageResponseTime
    };
  }

  /**
   * Get recent API logs
   */
  getRecentLogs(count: number = 10): ApiUsageLog[] {
    return this.apiLogs.slice(-count);
  }

  /**
   * Clear API logs
   */
  clearLogs(): void {
    this.apiLogs = [];
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendMessage('Hello! Please respond with "OK".');
      const text = this.extractTextContent(response);
      return text.includes('OK') || text.includes('ok');
    } catch {
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
  }
}

/**
 * Create a singleton instance of Claude client
 */
let claudeClientInstance: ClaudeClient | null = null;

/**
 * Get or create Claude client instance
 */
export function getClaudeClient(config?: Partial<ClaudeApiConfig>): ClaudeClient {
  if (!claudeClientInstance) {
    claudeClientInstance = new ClaudeClient(config);
  }
  return claudeClientInstance;
}

/**
 * Reset Claude client instance (useful for testing)
 */
export function resetClaudeClient(): void {
  claudeClientInstance = null;
}
