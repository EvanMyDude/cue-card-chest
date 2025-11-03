# Phase 5: Testing and Verification Guide

## Overview
Comprehensive testing procedures for the offline-first sync system with conflict detection and migration flow.

---

## Unit Tests

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test checksum
npm test importer
npm test conflictDetection

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Test Files

1. **`src/lib/__tests__/checksum.test.ts`**
   - SHA-256 determinism
   - Text normalization
   - Collision resistance
   - Format validation

2. **`src/lib/__tests__/importer.test.ts`**
   - Deduplication logic
   - Tag mapping and reuse
   - Batch processing (200 records)
   - Error handling

3. **`src/lib/__tests__/conflictDetection.test.ts`**
   - 30-second window logic
   - Checksum mismatch detection
   - Conflict resolution strategies
   - Time-based scenarios

---

## Manual Testing Checklist

### Test 1: Offline Edit → Reconnect → Conflict Detection

**Scenario:** Two devices edit the same prompt while offline, then sync.

#### Setup
1. Open app in two browser tabs (Tab A and Tab B)
2. Login as the same user
3. Both tabs show the same prompt: "Test Prompt"

#### Steps

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | **Tab A:** Go offline (Dev Tools → Network → Offline) | Network indicator shows offline | |
| 2 | **Tab A:** Edit "Test Prompt" title to "Edited by A" | Changes saved to IndexedDB instantly | |
| 3 | **Tab B:** Go offline | Network indicator shows offline | |
| 4 | **Tab B:** Edit "Test Prompt" title to "Edited by B" | Changes saved to IndexedDB instantly | |
| 5 | **Tab A:** Go online | Starts syncing, shows "Syncing..." | |
| 6 | **Tab A:** Wait for sync | Sync completes, prompt is "Edited by A" | |
| 7 | **Tab B:** Go online after 40 seconds | Starts syncing | |
| 8 | **Tab B:** Check sync status | Conflict detected! Shows conflict dialog | |
| 9 | **Tab B:** View conflict details | Shows both versions with timestamps | |
| 10 | **Tab B:** Choose "Keep Current" | Prompt remains "Edited by B" | |
| 11 | **Tab B:** Check server | Server now has "Edited by B" | |
| 12 | **Tab A:** Refresh | Shows "Edited by B" (conflict resolved) | |

**Critical Checks:**
- [ ] Conflict only appears when edits are >30s apart
- [ ] Both versions visible in conflict dialog
- [ ] Resolution updates all devices
- [ ] No data loss

---

### Test 2: Cross-Device Sync Validation

**Scenario:** Edit on Device A, verify sync to Device B.

#### Setup
1. Login on Device A (laptop)
2. Login on Device B (phone or different browser)
3. Both show same prompt list

#### Steps

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | **Device A:** Create new prompt "Sync Test" | Appears in list instantly | |
| 2 | **Device A:** Check sync status | Shows "Syncing..." then "Synced" | |
| 3 | **Device B:** Wait 5 seconds | Auto-pulls changes from server | |
| 4 | **Device B:** Check prompt list | "Sync Test" appears | |
| 5 | **Device B:** Edit "Sync Test" content | Changes saved and synced | |
| 6 | **Device A:** Wait 5 seconds | Shows updated content | |
| 7 | **Device A:** Pin "Sync Test" | Pin syncs to server | |
| 8 | **Device B:** Check pin status | Prompt is pinned | |
| 9 | **Device B:** Add tag "JavaScript" | Tag syncs | |
| 10 | **Device A:** Check tags | Shows "JavaScript" tag | |

**Critical Checks:**
- [ ] Changes appear within 30 seconds
- [ ] No duplicate prompts
- [ ] Tags sync correctly
- [ ] Pin status syncs
- [ ] Timestamps update correctly

---

### Test 3: Backup / Import Round-Trip

**Scenario:** Export localStorage, import to Supabase, verify data integrity.

#### Setup
1. Populate localStorage with 50 test prompts
2. Logout (clear Supabase session)
3. Login fresh

#### Steps

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | Login as new user | Migration dialog appears | |
| 2 | Check backup summary | Shows 50 prompts, X tags | |
| 3 | Click "Download Backup" | File downloads: `prompts-backup-YYYY-MM-DD.json` | |
| 4 | Open backup file | Valid JSON with manifest + prompts | |
| 5 | Verify checksums | All prompts have checksums in manifest | |
| 6 | Enter device name: "Test Device" | Device name accepted | |
| 7 | Click "Register Device" | Device registered successfully | |
| 8 | Click "Import to Cloud" | Import starts, progress bar appears | |
| 9 | Watch progress | Shows "Importing 50/50 prompts..." | |
| 10 | Wait for completion | Shows "Import complete! 50 imported, 0 skipped" | |
| 11 | Check prompt list | All 50 prompts visible | |
| 12 | Verify tags | All tags imported correctly | |
| 13 | Check pin status | Pinned prompts still pinned | |
| 14 | Verify order | Prompt order preserved | |
| 15 | Check content | Random sample: content intact | |

**Critical Checks:**
- [ ] All prompts imported (imported + skipped = total)
- [ ] No duplicates created
- [ ] Tags mapped correctly
- [ ] Metadata preserved (pin, order, timestamps)
- [ ] Checksums match

**Deduplication Test:**
- [ ] Re-import same backup
- [ ] Expected: 0 imported, 50 skipped
- [ ] No errors

---

### Test 4: Error and Rollback Simulation

**Scenario:** Simulate network errors and verify recovery.

#### Test 4A: Interrupted Import

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | Start import with 300 prompts | Import begins, progress updates | |
| 2 | At 50% progress, go offline | Import pauses or fails gracefully | |
| 3 | Check error message | Shows network error | |
| 4 | Go online | Option to "Retry" appears | |
| 5 | Click "Retry" | Resumes from where it left off | |
| 6 | Wait for completion | Import completes, shows partial count | |

**Critical Checks:**
- [ ] No partial data corruption
- [ ] Retry works correctly
- [ ] Error messages clear

#### Test 4B: Sync Queue Overflow

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | Go offline | Network status shows offline | |
| 2 | Create 100 new prompts rapidly | All saved to IndexedDB | |
| 3 | Check sync queue status | Shows "100 pending" | |
| 4 | Create 50 more prompts | Queue accepts more items | |
| 5 | Go online | Auto-flush starts | |
| 6 | Watch sync progress | Batches of 200 syncing | |
| 7 | Wait for completion | All 150 synced | |

**Critical Checks:**
- [ ] Queue doesn't overflow (max 1000)
- [ ] Batch processing works (≤200/batch)
- [ ] All items eventually sync

#### Test 4C: Parked Items Recovery

| Step | Action | Expected Outcome | Actual Outcome |
|------|--------|------------------|----------------|
| 1 | Mock network errors (Dev Tools) | Sync fails | |
| 2 | Create 1 prompt, trigger sync | Fails, attempt count = 1 | |
| 3 | Retry 4 more times | Attempt count reaches 5 | |
| 4 | Check sync queue status | Shows "1 parked item" | |
| 5 | Fix network (remove mock) | Network healthy | |
| 6 | Click "Retry Parked Items" | Item resets to attempt 0 | |
| 7 | Wait for sync | Item syncs successfully | |

**Critical Checks:**
- [ ] Items park after 5 failures
- [ ] Parked items visible in UI
- [ ] Retry resets attempt count
- [ ] Parked items eventually sync

---

### Test 5: Performance and Edge Cases

#### Test 5A: Large Dataset

| Scenario | Input | Expected Result | Actual Result |
|----------|-------|-----------------|---------------|
| Import 5000 prompts (max) | 5000 prompts in backup | Imports in <2 min | |
| Import 5001 prompts | Over limit | Error: "Too many prompts" | |
| Backup 5000 prompts | localStorage with 5000 | Creates backup <10MB | |
| Backup >10MB | Very large content | Error: "Backup too large" | |

#### Test 5B: Special Characters

| Scenario | Input | Expected Result | Actual Result |
|----------|-------|-----------------|---------------|
| Unicode in title | "测试 Тест 🚀" | Syncs correctly | |
| Emojis in content | "Hello 👋 World 🌍" | Preserved exactly | |
| Code blocks | Backticks, code | No escaping issues | |
| Line breaks | \n, \r\n, multiple | Normalized correctly | |

#### Test 5C: Timing Edge Cases

| Scenario | Timing | Expected Result | Actual Result |
|----------|--------|-----------------|---------------|
| Edit at exactly 30s | T+30000ms | No conflict (within window) | |
| Edit at 30.1s | T+30100ms | Conflict (outside window) | |
| Same-device rapid edits | <1s apart | Last write wins | |
| Network lag | 5s delay | Eventual consistency | |

---

## Automated Test Results Template

```
Test Suite: Checksum Utilities
✓ normalizeText - trim whitespace (2ms)
✓ normalizeText - normalize line endings (1ms)
✓ computeChecksum - deterministic output (15ms)
✓ computeChecksum - collision resistance (20ms)
✓ isValidChecksum - format validation (1ms)
Tests: 5 passed, 0 failed
Time: 0.5s

Test Suite: Importer Logic
✓ deduplication - skip existing (50ms)
✓ deduplication - import new (45ms)
✓ tag mapping - create tags (30ms)
✓ tag mapping - reuse existing (25ms)
✓ batch processing - 250 prompts (100ms)
✓ error handling - missing checksum (10ms)
Tests: 6 passed, 0 failed
Time: 1.2s

Test Suite: Conflict Detection
✓ 30-second window - within range (1ms)
✓ 30-second window - outside range (1ms)
✓ checksum mismatch - detect conflict (5ms)
✓ sync-prompts - conflict array (40ms)
✓ resolve-conflict - keep-current (35ms)
✓ resolve-conflict - use-revision (35ms)
Tests: 6 passed, 0 failed
Time: 0.8s

Total: 17 passed, 0 failed
Runtime: <3s ✓
```

---

## Troubleshooting Common Issues

### Issue: Conflict Not Detected

**Symptoms:** Both devices sync without conflict even when >30s apart.

**Debug Steps:**
1. Check server logs for `sync-prompts` edge function
2. Verify timestamps in database: `SELECT id, updated_at FROM prompts`
3. Check client-side checksum computation
4. Review `computeChecksum` output vs server

**Expected Fix:** Ensure server uses `EXTRACT(EPOCH FROM ...)` for time diff.

---

### Issue: Import Skips All Prompts

**Symptoms:** Dry run says "would import 50", but actual import imports 0.

**Debug Steps:**
1. Compare checksums: client vs server
2. Check for normalization differences
3. Verify `compute_checksum` function in Supabase matches client
4. Look for encoding issues (UTF-8)

**Expected Fix:** Ensure text normalization is identical on both sides.

---

### Issue: Parked Items Never Retry

**Symptoms:** Items stuck in "parked" state, retry does nothing.

**Debug Steps:**
1. Check `useSyncQueue` attempt tracking
2. Verify `MAX_ATTEMPTS` constant (should be 5)
3. Check retry logic resets attempts
4. Review sync queue in IndexedDB

**Expected Fix:** Ensure `retryParked()` clears and re-adds with attempt=0.

---

## Final Checklist

Before marking Phase 5 complete:

- [ ] All unit tests pass (<10s runtime)
- [ ] No console errors during tests
- [ ] Manual Test 1 (conflict detection) verified
- [ ] Manual Test 2 (cross-device sync) verified
- [ ] Manual Test 3 (backup/import) verified
- [ ] Manual Test 4 (error recovery) verified
- [ ] Edge cases tested (special chars, timing)
- [ ] Performance acceptable (5000 prompts <2min)
- [ ] Documentation complete (TESTING.md)

---

## Next Phase

**Phase 6: UI Integration and Polish**
1. Wire sync status to UI indicators
2. Build conflict resolution dialog
3. Add progress bars for import
4. Style with design system
5. End-to-end testing with real users
