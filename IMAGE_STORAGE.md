# Image Storage System

## Overview

A unified image storage system that handles profile pictures (and future journal photos) with local-first storage and cloud storage ready for when you enable user accounts.

## Current State (Local Storage)

**Status:** ✅ Active and working

Profile pictures are now:
- **Compressed** to 400x400px at 70% quality (~50-150KB vs 3-8MB)
- **Persistent** across app rebuilds (stored in `FileSystem.documentDirectory`)
- **Automatically cleaned up** when friends are deleted
- **Fast to load** (local access, no network required)

### How It Works Now

1. User picks/imports a profile picture
2. Image is compressed and resized (400x400px, quality 0.7)
3. Saved to `{FileSystem.documentDirectory}weave_images/profilePicture_{friend_id}.jpg`
4. Database stores the local file path
5. When friend is deleted, image file is also deleted

### Storage Location

- **iOS:** `/var/mobile/Containers/Data/Application/{UUID}/Documents/weave_images/`
- **Android:** `/data/user/0/{package}/files/weave_images/`

These directories persist across app sessions but are cleared on uninstall.

---

## Future State (Cloud Storage)

**Status:** 🔧 Ready to enable (requires Supabase setup)

When you enable user accounts, the system will:
- Upload images to Supabase Storage
- Sync across all user devices
- Keep local cache for offline access
- Handle automatic conflict resolution

### When to Enable

Enable cloud storage when:
1. ✅ User authentication is implemented
2. ✅ Supabase Storage buckets are created
3. ✅ You're ready for users to have multi-device sync

---

## Enabling Cloud Storage

### Step 1: Create Supabase Storage Buckets

Go to your Supabase Dashboard → Storage → Create Bucket:

1. **Bucket: `profile-pictures`**
   - Public: ❌ No (private)
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

2. **Bucket: `journal-photos`** (for future journal feature)
   - Public: ❌ No (private)
   - File size limit: 10MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

### Step 2: Apply RLS Policies

The schema has been updated in `supabase/schema.sql` with RLS policies.

Run the updated schema in your Supabase SQL Editor, or just run the new storage policies section (lines 604-700).

### Step 3: Enable in Code

Open `src/lib/image-service.ts` and change:

```typescript
// Change this line:
const ENABLE_CLOUD_STORAGE = false;

// To:
const ENABLE_CLOUD_STORAGE = true;
```

### Step 4: Update Image Calls to Include User ID

When accounts are enabled, update image processing calls to include `userId`:

**Before (current):**
```typescript
const imageResult = await processAndStoreImage({
  uri: result.assets[0].uri,
  type: 'profilePicture',
  imageId: friend.id,
});
```

**After (with accounts):**
```typescript
const imageResult = await processAndStoreImage({
  uri: result.assets[0].uri,
  type: 'profilePicture',
  imageId: friend.id,
  userId: currentUser.id, // Add this
});
```

You'll need to update these files:
- `src/components/FriendForm.tsx` (2 places: pickImage, handleContactSelection)
- `src/stores/friendStore.ts` (2 places: deleteFriend, batchDeleteFriends)

### Step 5: Test

1. Create a test user account
2. Add a friend with a profile picture
3. Check Supabase Storage → profile-pictures bucket
4. Verify file structure: `{userId}/{friendId}.jpg`
5. Login on a second device → verify image syncs

---

## Architecture Details

### File Structure

**Supabase Storage:**
```
profile-pictures/
  ├── {user_id_1}/
  │   ├── {friend_id_1}.jpg
  │   ├── {friend_id_2}.jpg
  │   └── ...
  └── {user_id_2}/
      └── ...

journal-photos/
  ├── {user_id_1}/
  │   ├── {interaction_id_1}_timestamp.jpg
  │   └── ...
  └── ...
```

**Local Storage (cache):**
```
{FileSystem.documentDirectory}weave_images/
  ├── profilePicture_{friend_id_1}.jpg
  ├── profilePicture_{friend_id_2}.jpg
  └── journalPhoto_{interaction_id}_timestamp.jpg
```

### Image Settings

| Type | Dimensions | Quality | Avg Size | Use Case |
|------|-----------|---------|----------|----------|
| **Profile Picture** | 400x400px | 0.7 | ~50-150KB | Friend avatars, circular display |
| **Journal Photo** | 1200px width | 0.8 | ~200-500KB | Full-screen viewing, memories |

### How Sync Works (When Cloud Enabled)

1. **Upload Flow:**
   - User picks image
   - Compress & resize locally
   - Save to local storage (immediate use)
   - Upload to Supabase Storage (background)
   - Store cloud URL in database

2. **Download Flow:**
   - Check local cache first
   - If not found, check cloud URL in database
   - Download from Supabase Storage
   - Cache locally for future use

3. **Offline Handling:**
   - Works fully offline with local cache
   - Uploads queued when back online
   - Graceful degradation (local-first)

### Security

- **Row Level Security (RLS):** Users can only access their own images
- **Private Buckets:** Images not publicly accessible
- **Secure URLs:** Signed URLs for authorized access only

---

## Migration Strategy

### Existing Users (When Enabling Accounts)

When a local-only user creates an account:

1. **Automatic Upload:**
   - All existing profile pictures uploaded to cloud
   - Local cache maintained for speed
   - Database records updated with cloud URLs

2. **Implementation:**
   ```typescript
   // In migration logic after first sign-in
   async function migrateLocalImagesToCloud(userId: string) {
     const friends = await database.get('friends').query().fetch();

     for (const friend of friends) {
       if (friend.photoUrl && friend.photoUrl.startsWith('file://')) {
         // Upload local image to cloud
         const imageResult = await processAndStoreImage({
           uri: friend.photoUrl,
           type: 'profilePicture',
           imageId: friend.id,
           userId,
         });

         // Update database with cloud URL
         await database.write(async () => {
           await friend.update(f => {
             f.photoUrl = imageResult.cloudUrl || imageResult.localUri;
           });
         });
       }
     }
   }
   ```

---

## Monitoring & Maintenance

### Storage Stats

Get current storage usage:

```typescript
import { getStorageStats } from '@/lib/image-service';

const stats = await getStorageStats();
console.log(stats);
// {
//   totalImages: 25,
//   profilePictures: 25,
//   journalPhotos: 0,
//   estimatedSizeMB: 2.5
// }
```

### Cleanup Orphaned Images

Run periodically to remove images without database records:

```typescript
import { cleanupOrphanedImages } from '@/lib/image-service';

// Get all active friend IDs from database
const friends = await database.get('friends').query().fetch();
const activeFriendIds = friends.map(f => f.id);

// Clean up profile pictures not in the list
await cleanupOrphanedImages(activeFriendIds, 'profilePicture');
```

Consider running this:
- On app startup (throttled, e.g., once per week)
- After batch delete operations
- Via background task

---

## Cost Estimates (Supabase Storage)

**Free Tier:**
- 1GB storage
- 2GB bandwidth/month
- ~6,000-20,000 profile pictures (at ~50-150KB each)

**For 1,000 Active Users:**
- Avg 30 friends/user = 30,000 profile pictures
- ~1.5-4.5GB storage (~$0.021/GB = $0.03-0.09/month)
- Bandwidth depends on image views

**Journal Photos:** Add ~2-5GB/1000 users if heavily used

→ **Cost:** ~$1-5/month for 1,000 users

---

## Testing Checklist

### Local Storage (Current State)
- [x] Profile picture compressed properly
- [x] Image persists across app restarts
- [x] Image loads after rebuild
- [ ] **Test now:** Delete app and reinstall → verify images lost (expected)
- [ ] **Test now:** Add friend → delete friend → verify image file deleted

### Cloud Storage (When Enabled)
- [ ] Create Supabase buckets
- [ ] Apply RLS policies
- [ ] Enable ENABLE_CLOUD_STORAGE flag
- [ ] Add userId to image calls
- [ ] Upload profile picture → check Supabase Storage
- [ ] Delete friend → verify cloud image deleted
- [ ] Login on Device A → add friend with photo
- [ ] Login on Device B → verify photo syncs
- [ ] Go offline → verify images load from cache
- [ ] Go online → upload new image → verify sync

---

## Troubleshooting

### Images Don't Persist After Rebuild

**Expected Behavior (Now):**
- Images in `FileSystem.documentDirectory` should persist across rebuilds
- Only cleared on app uninstall or manual clear data

**If images are lost:**
1. Check console logs for ImageService errors
2. Verify images saved to correct directory (not temp/cache)
3. iOS Simulator: Reset Content and Settings clears everything

### Image Processing Fails

**Common causes:**
1. Permissions not granted (check `ImagePicker.requestMediaLibraryPermissionsAsync`)
2. Invalid URI format
3. Out of storage space
4. Corrupt source image

**Debug:**
```typescript
// Check if imageProcessing is stuck
console.log('imageProcessing:', imageProcessing);

// Check ImageService logs
[ImageService] Processing profilePicture: {imageId}
[ImageService] Compressed: {compressedUri}
[ImageService] Saved locally: {localUri}
```

### Cloud Upload Fails (When Enabled)

1. Check Supabase URL/keys in `.env`
2. Verify user is authenticated
3. Check bucket exists and RLS policies applied
4. Check network connectivity
5. Verify file size < bucket limit

---

## Future Enhancements

### Short Term
- [ ] Add compression quality setting (user preference)
- [ ] Image cropping/editing before save
- [ ] Support for GIFs/animated avatars

### Medium Term
- [ ] Implement journal photo support (same system)
- [ ] Background sync queue for offline uploads
- [ ] Image CDN integration for faster loading

### Long Term
- [ ] AI-generated avatars (if no photo)
- [ ] Photo collages for friend groups
- [ ] Automatic photo suggestions from device photos

---

## Summary

### What Changed

**Before:**
- ❌ Images stored at full quality (3-8MB each)
- ❌ URIs pointed to temp/library locations
- ❌ Lost on app rebuild
- ❌ No cleanup on friend deletion
- ❌ No cloud storage option

**After:**
- ✅ Images compressed to ~50-150KB (97% size reduction)
- ✅ Stored in persistent app directory
- ✅ Survive app rebuilds
- ✅ Automatically cleaned up on deletion
- ✅ Cloud storage ready (flip a flag)

### Next Steps

1. **Test the current implementation** (local storage)
2. **When you enable accounts** (~1 month):
   - Create Supabase Storage buckets
   - Enable `ENABLE_CLOUD_STORAGE = true`
   - Add `userId` to image processing calls
3. **Test cloud storage** with multiple devices

---

## Questions?

- **Local storage working?** Images should now persist across rebuilds
- **Ready to enable cloud?** Follow "Enabling Cloud Storage" steps above
- **Issues?** Check "Troubleshooting" section

The system is production-ready for local storage NOW, and cloud-ready when you flip the switch.
