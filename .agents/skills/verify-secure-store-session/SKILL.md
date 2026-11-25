---
name: verify-secure-store-session
description: "Formally verify UTF-8 chunking, keystore hygiene, crash-atomicity, and concurrency interleaving invariants for MyCCS's Expo SecureStore session adapter (`src/lib/supabase.ts`). Use whenever modifying `chunkUtf8`, `utf8CodePointBytes`, `utf8ByteLength`, `parseChunkCount`, or `createSecureStoreAdapter` in `src/lib/supabase.ts`."
---

# Verify SecureStore Session Adapter (`src/lib/supabase.ts`)

Bounded formal verifier that runs directly against the real TypeScript implementation of `chunkUtf8` and `createSecureStoreAdapter` in `src/lib/supabase.ts` (zero hand-model drift).

## Coverage Record

- **Verified file:** `src/lib/supabase.ts`
- **Covered symbols:** `SECURE_STORE_CHUNK_BYTES`, `utf8CodePointBytes`, `utf8ByteLength`, `chunkUtf8`, `chunkCountKey`, `chunkItemKey`, `parseChunkCount`, `createSecureStoreAdapter`
- **Verifier harness:** `scripts/verify/secure-store.verify.ts`
- **Last confirmed sync commit:** `ff53a4bdbdb3b20e09b0dd696521ba560ec47703`

Check whether covered code changed since the sync commit before trusting a pass:

```powershell
git diff ff53a4bdbdb3b20e09b0dd696521ba560ec47703 -- src/lib/supabase.ts
```

## Properties Verified

| ID | Property (plain English) | Harm if broken | Scope / Bounds |
|---|---|---|---|
| **P1** | `chunkUtf8` splits any string without data loss, without exceeding `maxBytes` UTF-8 bytes (`TextEncoder`), and without splitting UTF-16 surrogate pairs. | Chunks > 2048 bytes fail on iOS Keychain / Android Keystore; split surrogates corrupt auth JSON. | Exhaustive boundary sweep (`maxBytes ± 2`, `2*maxBytes ± 2`) across 1/2/3/4-byte code points (`maxBytes ∈ {4, 5, 7, 16, 1800}`) + 500 deterministic seeded mixed strings. |
| **P2** | Every sequential sequence of `setItem` (short, 2-chunk, 3-chunk) and `removeItem` returns exact last-written data, obeys `SECURE_STORE_CHUNK_BYTES`, and leaves zero stale base or tail-chunk keys. | Old JWT chunks linger in SecureStore after sign-out or shrink, or `getItem` returns stale sessions. | Exhaustive over all 340 operation sequences of length 1..4. |
| **P3** | Crashing between any two `store.*` calls during `setItem` or `removeItem` never causes a restart `getItem` to return a torn hybrid of old and new sessions. | OS kill mid-token-refresh permanently corrupts the stored session (`newChunk0 + oldChunk1`), locking out the user. | Exhaustive crash injection before every `store.*` step across all 16 transitions `{empty, short, 2-chunk, 3-chunk} × {short, 2-chunk, 3-chunk, remove}`. |
| **P4** | Running `getItem` concurrently with `setItem` (e.g., `getSession()` during `autoRefreshToken`) never returns a torn hybrid session. | Background token refresh racing with session read returns corrupted JSON in memory. | Exhaustive 256 step-interleaving schedules of length 8 on 2-chunk overwrite (`setItem \|\| getItem`). |

**Out of scope:** Native iOS Keychain / Android Keystore OS bugs, hardware encryption, Supabase Auth SDK internals, and multi-process contention across separate OS processes.

## How to Run

```powershell
npx jest --testMatch "<rootDir>/scripts/verify/secure-store.verify.ts" --no-coverage
```

- Runs in ~8–10 seconds with the repo's existing Jest + `jest-expo` setup (no extra tools required).
- Intentionally excluded from `npm test` (`*.verify.ts` is not matched by Jest's default `*.test.ts` glob) so open formal findings do not block unrelated unit tests while still being one command away.

## Interpreting Results

### Known Open Findings at Sync Commit `ff53a4bdbdb3b20e09b0dd696521ba560ec47703`
- **P1 & P2:** PASS.
- **P3 & P4:** FAIL (real bugs in `createSecureStoreAdapter.setItem` in `src/lib/supabase.ts` lines 149–159). `setItem` overwrites `key.__chunk_0`, `key.__chunk_1`, ... **in place** while `key.__chunks` still points to the old count. A crash or concurrent `getItem` after `setItemAsync(key.__chunk_0, new0)` and before `setItemAsync(key.__chunk_1, new1)` causes `getItem` to join `newChunk0 + oldChunk1` into a silently corrupted session.
  - **Fix direction (when requested):** Write new chunks under a monotonically increasing generation/epoch prefix (e.g., `${key}.__gen_${gen}_chunk_${i}`), atomically flip a single pointer key (`${key}.__meta = "${gen}:${count}"`), then delete the previous generation's chunks.

### Telling a Real Bug from a Verifier Error
- **Real bug:** The error reports a `P1`/`P2`/`P3`/`P4` invariant violation with an exact input, operation sequence, crash step, or interleaving trace where `createSecureStoreAdapter` or `chunkUtf8` returned wrong/torn data, exceeded `SECURE_STORE_CHUNK_BYTES`, or left unexpected keystore keys. **Do not weaken the property to make it pass.**
- **Verifier error:** Jest fails to compile/import `src/lib/supabase.ts` (e.g., a renamed export or changed `SecureStoreLike` method signature), or a legitimate key-naming schema change (like adding generation-prefixed keys to fix P3/P4) causes P2's expected-keys assertion to expect the old `.__chunk_i` key names.

## Updating the Verification After Intended Changes

1. If you change the chunking key layout (e.g., to fix P3/P4 with generation keys), update **only** the expected key-hygiene shape in P2 of `scripts/verify/secure-store.verify.ts` while keeping the "zero stale keys after remove/overwrite" invariant intact.
2. Re-run the verifier and confirm all properties pass (or only documented open findings fail).
3. Only after confirming `scripts/verify/secure-store.verify.ts` accurately describes the updated `src/lib/supabase.ts`, update **Last confirmed sync commit** in this file to the new commit SHA.
