// src/lib/oracle/oracle-service.ts
import { supabase } from '@/modules/auth/services/supabase.service';
import { SuggestionContext, WeeklyOracleInsight } from './types';

export interface OracleResponse {
  content: string;
  confidence?: number;
  suggestions?: string[];
}

export class OracleService {
  private static async callEdgeFunction(
    endpoint: string,
    payload: any
  ): Promise<OracleResponse> {
    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: payload
    });

    if (error) throw error;
    return data;
  }

  // Journal assistance
  static async reflectOnEntry(
    content: string,
    storyChips: string[],
    friendContext?: string[]
  ): Promise<OracleResponse> {
    return this.callEdgeFunction('oracle-journal', {
      action: 'reflect',
      content,
      storyChips,
      friendContext
    });
  }

  // Pattern analysis
  static async analyzePatterns(
    timeframe: 'week' | 'month',
    userId: string
  ): Promise<OracleResponse> {
    return this.callEdgeFunction('oracle-patterns', {
      timeframe,
      userId
    });
  }

  // Enhanced suggestions
  static async generateSuggestion(
    friendId: string,
    context: SuggestionContext
  ): Promise<OracleResponse> {
    return this.callEdgeFunction('oracle-suggestions', {
      friendId,
      context
    });
  }

  // Weekly insights + tarot
  static async generateWeeklyInsight(
    userId: string,
    includeTarot: boolean = true
  ): Promise<WeeklyOracleInsight> {
    return this.callEdgeFunction('oracle-weekly', {
      userId,
      includeTarot
    });
  }
}
