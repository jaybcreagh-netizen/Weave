/**
 * React Query Mutations
 *
 * This module provides React Query mutation hooks for API operations
 * that benefit from automatic retry, caching, and error handling.
 *
 * Use React Query mutations for:
 * - API calls (Supabase Edge Functions, LLM calls)
 * - Operations that benefit from automatic retry
 * - Cross-component state that needs to be synchronized
 *
 * Use useAction hook instead for:
 * - Local WatermelonDB operations (no retry needed)
 * - Simple one-off async operations
 */

export * from './llm-mutations';
export * from './supabase-mutations';
