/**
 * Oracle Module
 * 
 * Global AI assistant for Weave - provides contextual insights,
 * helps with writing reflections, and answers questions about relationships.
 */

// Components
export { OracleSheet } from './components/OracleSheet'
export { OracleChat } from './components/OracleChat'
export { StarterPromptChips } from './components/StarterPromptChips'
export { default as InsightsCarousel } from './components/InsightsCarousel'
export { InsightsChip } from './components/InsightsChip'
export { OracleActionButton } from './components/OracleActionButton'

// Hooks
export { useOracle } from './hooks/useOracle'
export { useOracleSheet } from './hooks/useOracleSheet'
export { useStarterPrompts } from './hooks/useStarterPrompts'
export type { OracleContext, OracleSheetParams } from './hooks/useOracleSheet'

// Services - export the service instance
export { oracleService } from './services/oracle-service'
export type { OracleTurn } from './services/oracle-service'
