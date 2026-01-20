# Referral Feature Spec Review

## Executive Summary

The proposed referral feature is **feasible** and aligns well with the current architecture (Supabase + WatermelonDB). The "MVP first" approach using manual codes is the correct strategy to avoid the complexity of deferred deep links immediately.

However, there is a **Critical User Experience Gap** regarding how the inviter (User A) transitions their local friend record to the newly created user (User B). Without addressing this, User A will likely end up with duplicate friends and disconnected weaves.

---

## 1. Feasibility & Architecture Fit

- **Supabase RPC**: The proposed `create_invite` and `claim_invite` RPC functions are the standard and correct way to handle this transactional logic.
- **Database**: The `invite_links` table design is sound for the server-side handshake.
- **WatermelonDB**: The local creation of `Weave` and `Friend` from a snapshot is consistent with the "Local First" philosophy.

## 2. Critical Issues & Holes

### A. The "Identity Merge" Gap (High Risk)
**Scenario**:
1. User A creates a weave with a local-only friend "Sarah" (e.g., `local_id_1`).
2. User A sends an invite code to Sarah.
3. Sarah (User B) installs, signs up, and claims the code.
4. User B gets the weave and a pending friend link to User A.
5. **The Problem:** User A's app has no way to knoe that `local_id_1` should now be linked to User B's new account.
   - **Result**: User A sees two Sarahs: "Sarah" (Local, who is on the weave) and "Sarah Jones" (New connected friend). The weave remains attached to the *Local* Sarah. User A feels the feature is "broken" because the connected friend isn't on the weave they just shared.

**Recommended Solution**:
- **Store Local Context**: The `create_invite` RPC should accept an optional `creator_friend_id` (User A's local ID for Sarah).
- **Return Context on Claim**: When User B claims, the system creates the friend link.
- **Resolution on User A**: When User A's app syncs and sees the new friend link, it needs a signal to merge it with `local_id_1`.
    - **Option 1 (Robust)**: Store `invite_code` on User A's local `Friend` record. When the Friend Link is established (via sync), check if it matches an active invite code's "claimed by" user? (Hard to coordinate).
    - **Option 2 (Pragmatic)**: When User B claims, the system handles User B. User A just gets a "Link Request". The *next time* User A interacts with the "Local Sarah" or the "New Sarah", they might need to manually merge.
    - **Option 3 (Spec Update)**: The `invite_links` table should store `creator_friend_local_id`. When User B claims, we trigger a notification to User A that says "Sarah has joined!". When User A taps it, the app asks "Is this the same Sarah from [Weave Name]?" and performs the merge.

### B. Data Staleness (Medium Risk)
**Scenario**: User A shares the invite. Ten minutes later, User A changes the time of the weave. Sarah claims the invite an hour later.
- **Current Spec**: Sarah gets the `weave_snapshot` from creation time (Old time).
- **Result**: Sarah shows up at the wrong time.
- **Recommendation**:
    - If the weave has been synced to the server (`server_id` exists), `invite_links` should reference it. The `claim_invite` RPC should try to fetch the *live* data first.
    *Fallback*: Use the snapshot only if the live weave cannot be found (e.g., deleted or not synced).

### C. Dependencies
- **Missing**: `react-native-deeplinknow` is not in `package.json`.
    - **Check**: Is this library well-maintained? It seems less common than `branch` or `appsflyer`.
    - **Alternative**: For MVP, `expo-linking` is sufficient for *direct* deep links (checking `Linking.getInitialURL()`). For *deferred* deep links (install attribution), a dedicated provider is needed. If postponing Smart Links, you don't need this dependency yet.

## 3. Implementation Details to Watch

### Friend Linking
- Ensure `friend-linking.service.ts` is updated to handle the "Auto-accept" nature of an invite claim. If User A sent the invite, they implicitly accept User B's friend request. The RPC `claim_invite` should probably insert the `friend_link` record directly with status 'accepted' (or 'linked').

### Auth Flow
- The spec says: *"Signs up ... Sees 'Have an invite code?' prompt"*.
- **UX Note**: This prompt should ideally be *part* of the sign-up flow, or the very first thing after sign-up, before they get to the dashboard. If they miss it, there should be a prominent "Redeem Invite" in Settings.

## 4. Modified Schema Suggestion

Add `creator_friend_local_id` to help with the merge problem later.

```sql
CREATE TABLE public.invite_links (
    ...
    creator_friend_local_id TEXT, -- User A's local reference to the invited friend
    ...
);
```

User A sends this ID when creating the invite. It's stored (opaquely) by the server. When User B claims, this ID is returned in the successful claim response (or sent via a notification payload to User A), allowing User A's app to perform the merge intelligence.
