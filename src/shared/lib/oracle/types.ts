// src/lib/oracle/types.ts

export interface SuggestionContext {
  // Define the properties of SuggestionContext here
}

export interface WeeklyOracleInsight {
  // Define the properties of WeeklyOracleInsight here
  narrative: string;
  tarotCard: {
    name: string;
    interpretation: string;
  } | null;
}
