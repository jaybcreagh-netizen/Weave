function readBooleanEnv(name: string): boolean {
  return process.env[name] === 'true';
}

export function isOpportunitySystemShadowModeEnabled(): boolean {
  return readBooleanEnv('EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE');
}

export function isFocusSelectorEnabled(): boolean {
  return readBooleanEnv('EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED');
}

export function isOpportunityNotificationsEnabled(): boolean {
  return readBooleanEnv('EXPO_PUBLIC_OPPORTUNITY_NOTIFICATIONS_ENABLED');
}

export function isOpportunityPoolEnabled(): boolean {
  return readBooleanEnv('EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED');
}
