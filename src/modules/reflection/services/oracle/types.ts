// src/lib/oracle/types.ts

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
