---
description: Push a new Fastlane build to TestFlight
---

1. Ensure the git working directory is clean.
   - Run `git status` to check.
   - If not clean, commit or stash changes.

2. Navigate to the `ios` directory.
   - `cd ios`

3. Run the Fastlane beta lane.
   // turbo
   - `bundle exec fastlane beta`

4. Monitor the output for success or errors.
