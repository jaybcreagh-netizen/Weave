# Phase 3 Deployment Instructions 🚀

To enable Contact Discovery, you need to apply database changes and deploy a server-side function.

### 1. Database Migration 🗄️
Run this SQL in your **Supabase Dashboard > SQL Editor**:
(Or use `supabase db push` if you have the CLI configured)

```sql
-- file: supabase/migrations/phase3_full_migration.sql
-- (Content of this file is available in your workspace)
```
Run the content of `supabase/migrations/phase3_full_migration.sql` in your SQL Editor. This file handles everything: adding columns (`phone`, `email`), adding the hash column, and setting up the trigger.

### 2. Deploy Edge Function ⚡️
This function handles the private matching logic.

Run in your terminal (root of project):
```bash
npx supabase functions deploy match-contacts --no-verify-jwt
```
*(If `npx supabase` isn't available, you may need to install the CLI or copy the code from `supabase/functions/match-contacts/index.ts` to the Supabase Dashboard manually).*

**Environment Variables**:
Ensure your Edge Function has access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These are usually default, but check **Edge Functions > Secrets** in the dashboard if you encounter 500 errors.
