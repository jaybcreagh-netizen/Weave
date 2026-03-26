import type { Opportunity, ScoredOpportunity, SelectionResult } from './types';
import type {
  ScoringWeights,
  SelectionConfig,
  SelectorSignals,
  SuppressionResult,
} from './scoring/score-types';
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_SELECTION_CONFIG } from './scoring/score-types';
import { evaluateOpportunitySuppressors } from './scoring/suppressors';
import { scoreOpportunities, selectOpportunities } from './scoring/score-opportunity';

export interface FocusSelectorEvaluation {
  suppressed: SuppressionResult<Opportunity>[];
  eligible: Opportunity[];
  scored: ScoredOpportunity[];
  selection: SelectionResult;
}

export interface FocusSelectorOptions {
  weights?: ScoringWeights;
  selectionConfig?: SelectionConfig;
}

export const FocusSelectorService = {
  evaluate(
    opportunities: Opportunity[],
    signals: SelectorSignals,
    options: FocusSelectorOptions = {}
  ): FocusSelectorEvaluation {
    const suppressed = evaluateOpportunitySuppressors(opportunities, signals);
    const eligible = suppressed
      .filter(result => result.reasons.length === 0)
      .map(result => result.opportunity);
    const scored = scoreOpportunities(
      eligible,
      signals,
      options.weights || DEFAULT_SCORING_WEIGHTS
    );
    const selection = selectOpportunities(
      scored,
      options.selectionConfig || DEFAULT_SELECTION_CONFIG
    );

    return {
      suppressed,
      eligible,
      scored,
      selection,
    };
  },
};
