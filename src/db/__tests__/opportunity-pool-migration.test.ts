import fs from 'fs';
import path from 'path';

const schemaSource = fs.readFileSync(path.join(process.cwd(), 'src/db/schema.ts'), 'utf8');
const migrationsSource = fs.readFileSync(path.join(process.cwd(), 'src/db/migrations.ts'), 'utf8');

describe('opportunity pool schema + migration definitions', () => {
  it('defines the Phase 3 opportunity tables and profile fields in schema v83', () => {
    expect(schemaSource).toContain('version: 83');
    expect(schemaSource).toContain("name: 'opportunity_pool'");
    expect(schemaSource).toContain("name: 'surfacing_log'");
    expect(schemaSource).toContain("name: 'friend_tier'");
    expect(schemaSource).toContain("name: 'momentum_score'");
    expect(schemaSource).toContain("name: 'copy_context_json'");
    expect(schemaSource).toContain("name: 'suggestion_payload_json'");
    expect(schemaSource).toContain("name: 'presentation_copy_json'");
    expect(schemaSource).toContain("name: 'surface_source'");
    expect(schemaSource).toContain("name: 'threshold_variant'");
    expect(schemaSource).toContain("name: 'copy_variant'");
    expect(schemaSource).toContain("name: 'quiet_reason'");
    expect(schemaSource).toContain("name: 'surface_request_kind'");
    expect(schemaSource).toContain("name: 'pacing_snapshot_json'");
    expect(schemaSource).toContain("name: 'preferred_suggestion_windows_json'");
    expect(schemaSource).toContain("name: 'timing_profile_json'");
    expect(schemaSource).toContain("name: 'suggestion_frequency'");
    expect(schemaSource).toContain("name: 'last_pool_refresh'");
    expect(schemaSource).toContain("name: 'pool_refresh_state_json'");
    expect(schemaSource).toContain("name: 'calendar_permission_granted'");
    expect(schemaSource).toContain("name: 'last_app_open'");
  });

  it('defines additive v77 migration steps for opportunity persistence', () => {
    expect(migrationsSource).toContain('toVersion: 77');
    expect(migrationsSource).toContain("name: 'opportunity_pool'");
    expect(migrationsSource).toContain("name: 'surfacing_log'");
    expect(migrationsSource).toContain("table: 'user_profile'");
    expect(migrationsSource).toContain("name: 'preferred_suggestion_windows_json'");
    expect(migrationsSource).toContain("name: 'pool_refresh_state_json'");
    expect(migrationsSource).toContain("name: 'last_app_open'");
  });

  it('defines additive v78 migration steps for richer opportunity pool context', () => {
    expect(migrationsSource).toContain('toVersion: 78');
    expect(migrationsSource).toContain("table: 'opportunity_pool'");
    expect(migrationsSource).toContain("name: 'friend_tier'");
    expect(migrationsSource).toContain("name: 'momentum_score'");
    expect(migrationsSource).toContain("name: 'copy_context_json'");
    expect(migrationsSource).toContain("table: 'surfacing_log'");
    expect(migrationsSource).toContain("name: 'surface_source'");
    expect(migrationsSource).toContain("name: 'selection_reason'");
    expect(migrationsSource).toContain("name: 'surface_slot'");
    expect(migrationsSource).toContain("name: 'opportunity_source'");
  });

  it('defines additive v79 migration steps for cached presentation copy', () => {
    expect(migrationsSource).toContain('toVersion: 79');
    expect(migrationsSource).toContain("table: 'opportunity_pool'");
    expect(migrationsSource).toContain("name: 'presentation_copy_json'");
  });

  it('defines additive v80 migration steps for surfaced presentation copy logging', () => {
    expect(migrationsSource).toContain('toVersion: 80');
    expect(migrationsSource).toContain("table: 'surfacing_log'");
    expect(migrationsSource).toContain("name: 'presentation_copy_json'");
  });

  it('defines additive v81 migration steps for selector experiment logging', () => {
    expect(migrationsSource).toContain('toVersion: 81');
    expect(migrationsSource).toContain("table: 'surfacing_log'");
    expect(migrationsSource).toContain("name: 'threshold_variant'");
    expect(migrationsSource).toContain("name: 'copy_variant'");
  });

  it('defines additive v82 migration steps for custom suggestion payload persistence', () => {
    expect(migrationsSource).toContain('toVersion: 82');
    expect(migrationsSource).toContain("table: 'opportunity_pool'");
    expect(migrationsSource).toContain("name: 'suggestion_payload_json'");
  });

  it('defines additive v83 migration steps for selector pacing telemetry', () => {
    expect(migrationsSource).toContain('toVersion: 83');
    expect(migrationsSource).toContain("table: 'surfacing_log'");
    expect(migrationsSource).toContain("name: 'quiet_reason'");
    expect(migrationsSource).toContain("name: 'surface_request_kind'");
    expect(migrationsSource).toContain("name: 'pacing_snapshot_json'");
  });
});
