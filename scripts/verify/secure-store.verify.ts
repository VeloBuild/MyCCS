/**
 * Formal bounded verifier for `src/lib/supabase.ts` (`chunkUtf8` & `createSecureStoreAdapter`).
 *
 * Run standalone (excluded from `npm test` because it is not a `*.test.ts` file):
 *   npx jest --testMatch "<rootDir>/scripts/verify/secure-store.verify.ts" --no-coverage
 */
import {
  chunkUtf8,
  createSecureStoreAdapter,
  SECURE_STORE_CHUNK_BYTES,
  type SecureStoreLike,
} from '../../src/lib/supabase';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const encoder = new TextEncoder();
const KEY = 'sb-session';

function utf8Bytes(value: string): number {
  return encoder.encode(value).byteLength;
}

function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function makeLabeledValue(tag: string, byteTarget: number): string {
  const prefix = `${tag}:`;
  return prefix + tag.repeat(Math.max(0, byteTarget - prefix.length));
}

function createMemoryStore(
  initial?: Map<string, string>,
  onSet?: (key: string, value: string) => void
): { map: Map<string, string>; store: SecureStoreLike } {
  const map = new Map<string, string>(initial);
  const store: SecureStoreLike = {
    getItemAsync: async (key) => map.get(key) ?? null,
    setItemAsync: async (key, value) => {
      onSet?.(key, value);
      map.set(key, value);
    },
    deleteItemAsync: async (key) => {
      map.delete(key);
    },
  };
  return { map, store };
}

function formatTrace(steps: string[]): string {
  return steps.map((s, idx) => `  ${idx + 1}. ${s}`).join('\n');
}

function summarizeSessionValue(value: string | null): string {
  if (value === null) return 'null';
  const head = value.slice(0, 12);
  const tail = value.slice(-12);
  return `"${head}...${tail}" (${utf8Bytes(value)} bytes)`;
}

/** Deterministic PRNG (Mulberry32) for reproducible generated-input checks. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Formal Verification: SecureStore chunking & session adapter (src/lib/supabase.ts)', () => {
  it('P1: chunkUtf8 is lossless, respects maxBytes in UTF-8, and never splits surrogate pairs', () => {
    const alphabetByWidth = [
      { label: '1-byte ASCII', ch: 'a', bytes: 1 },
      { label: '2-byte Latin', ch: 'ñ', bytes: 2 },
      { label: '3-byte Peso', ch: '₱', bytes: 3 },
      { label: '4-byte Emoji', ch: '🎓', bytes: 4 },
    ];

    const check = (value: string, maxBytes: number, context: string) => {
      const chunks = chunkUtf8(value, maxBytes);
      if (chunks.join('') !== value) {
        throw new Error(`P1 lossless violation (${context}): rejoined chunks differ from input.`);
      }
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const actualBytes = utf8Bytes(chunk);
        if (actualBytes > maxBytes) {
          throw new Error(
            `P1 byte-limit violation (${context}): chunk[${i}] is ${actualBytes} UTF-8 bytes (> ${maxBytes}).`
          );
        }
        if (value.length > 0 && chunk.length === 0) {
          throw new Error(`P1 empty-chunk violation (${context}): chunk[${i}] is empty.`);
        }
        if (!hasLoneSurrogate(value) && hasLoneSurrogate(chunk)) {
          throw new Error(
            `P1 surrogate-split violation (${context}): chunk[${i}] contains a lone UTF-16 surrogate.`
          );
        }
      }
    };

    // Exhaustive boundary sweep around maxBytes and 2 * maxBytes for every UTF-8 width.
    for (const maxBytes of [4, 5, 7, 16, SECURE_STORE_CHUNK_BYTES]) {
      check('', maxBytes, `empty, maxBytes=${maxBytes}`);
      for (const { label, ch, bytes } of alphabetByWidth) {
        const counts = new Set<number>([1, 2]);
        for (const target of [maxBytes, maxBytes * 2]) {
          const base = Math.max(1, Math.floor(target / bytes));
          for (let delta = -2; delta <= 2; delta += 1) {
            if (base + delta >= 1) counts.add(base + delta);
          }
        }
        for (const count of counts) {
          check(ch.repeat(count), maxBytes, `${label} x${count}, maxBytes=${maxBytes}`);
        }
      }
    }

    // Deterministic seeded fuzzing (500 mixed 1/2/3/4-byte strings).
    const rand = mulberry32(0x20261125);
    const chars = ['a', 'Z', '{', '"', 'ñ', 'é', '₱', '中', '🎓', '🔐'];
    for (let trial = 0; trial < 500; trial += 1) {
      const maxBytes = [4, 5, 7, 16, 64, SECURE_STORE_CHUNK_BYTES][trial % 6];
      const len = Math.floor(rand() * (maxBytes === SECURE_STORE_CHUNK_BYTES ? 1200 : 80));
      let s = '';
      for (let j = 0; j < len; j += 1) {
        s += chars[Math.floor(rand() * chars.length)];
      }
      check(s, maxBytes, `seeded trial #${trial}, maxBytes=${maxBytes}, len=${len}`);
    }
  });

  it('P2: exhaustive sequential state machine (all 340 sequences of length 1..4) preserves data, byte limits, and zero stale keys', async () => {
    const shortVal = makeLabeledValue('S', 64);
    const twoChunkVal = makeLabeledValue('M', SECURE_STORE_CHUNK_BYTES + 200);
    const threeChunkVal = makeLabeledValue('L', SECURE_STORE_CHUNK_BYTES * 2 + 200);

    type Op =
      | { name: 'set(short)'; kind: 'set'; value: string; expectedChunks: 0 }
      | { name: 'set(2-chunk)'; kind: 'set'; value: string; expectedChunks: 2 }
      | { name: 'set(3-chunk)'; kind: 'set'; value: string; expectedChunks: 3 }
      | { name: 'remove'; kind: 'remove'; expectedChunks: null };

    const ops: Op[] = [
      { name: 'set(short)', kind: 'set', value: shortVal, expectedChunks: 0 },
      { name: 'set(2-chunk)', kind: 'set', value: twoChunkVal, expectedChunks: 2 },
      { name: 'set(3-chunk)', kind: 'set', value: threeChunkVal, expectedChunks: 3 },
      { name: 'remove', kind: 'remove', expectedChunks: null },
    ];

    const verifySequence = async (seq: Op[]) => {
      const violations: string[] = [];
      const { map, store } = createMemoryStore(undefined, (k, v) => {
        if (utf8Bytes(v) > SECURE_STORE_CHUNK_BYTES) {
          violations.push(`setItemAsync(${k}) wrote ${utf8Bytes(v)} bytes (> ${SECURE_STORE_CHUNK_BYTES})`);
        }
      });
      const adapter = createSecureStoreAdapter(store);
      let expectedValue: string | null = null;
      let expectedChunks: 0 | 2 | 3 | null = null;

      for (const op of seq) {
        if (op.kind === 'set') {
          await adapter.setItem(KEY, op.value);
          expectedValue = op.value;
          expectedChunks = op.expectedChunks;
        } else {
          await adapter.removeItem(KEY);
          expectedValue = null;
          expectedChunks = null;
        }

        const actual = await adapter.getItem(KEY);
        const trace = seq.map((o) => o.name).join(' -> ');
        if (violations.length > 0) {
          throw new Error(`P2 byte-limit violation on [${trace}]: ${violations.join('; ')}`);
        }
        if (actual !== expectedValue) {
          throw new Error(
            `P2 round-trip violation on [${trace}]: expected ${summarizeSessionValue(expectedValue)}, got ${summarizeSessionValue(actual)}.`
          );
        }

        const keys = [...map.keys()].sort();
        const expectedKeys =
          expectedChunks === null
            ? []
            : expectedChunks === 0
              ? [KEY]
              : [
                  `${KEY}.__chunks`,
                  ...Array.from({ length: expectedChunks }, (_, i) => `${KEY}.__chunk_${i}`),
                ].sort();

        if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
          throw new Error(
            `P2 stale-key violation on [${trace}]: expected keystore keys ${JSON.stringify(expectedKeys)}, found ${JSON.stringify(keys)}.`
          );
        }
      }
    };

    const enumerate = async (depth: number, prefix: Op[]) => {
      if (prefix.length > 0) {
        await verifySequence(prefix);
      }
      if (depth === 0) return;
      for (const op of ops) {
        await enumerate(depth - 1, [...prefix, op]);
      }
    };

    await enumerate(4, []);
  });

  it('P3: crash-atomicity — crashing between any two SecureStore calls never causes a torn read', async () => {
    const states: Array<{ label: string; value: string | null }> = [
      { label: 'empty', value: null },
      { label: 'short', value: makeLabeledValue('A', 64) },
      { label: '2-chunk', value: makeLabeledValue('A', SECURE_STORE_CHUNK_BYTES + 200) },
      { label: '3-chunk', value: makeLabeledValue('A', SECURE_STORE_CHUNK_BYTES * 2 + 200) },
    ];
    const nextOps: Array<{ label: string; kind: 'set' | 'remove'; value: string | null }> = [
      { label: 'set(short)', kind: 'set', value: makeLabeledValue('B', 64) },
      { label: 'set(2-chunk)', kind: 'set', value: makeLabeledValue('B', SECURE_STORE_CHUNK_BYTES + 200) },
      { label: 'set(3-chunk)', kind: 'set', value: makeLabeledValue('B', SECURE_STORE_CHUNK_BYTES * 2 + 200) },
      { label: 'remove', kind: 'remove', value: null },
    ];

    class SimulatedCrash extends Error {}

    const findings: string[] = [];

    for (const init of states) {
      for (const nextOp of nextOps) {
        // First, count how many store calls this transition makes.
        const baseline = createMemoryStore();
        const baselineAdapter = createSecureStoreAdapter(baseline.store);
        if (init.value !== null) {
          await baselineAdapter.setItem(KEY, init.value);
        }
        const initialSnapshot = new Map(baseline.map);

        let totalCalls = 0;
        const countingStore: SecureStoreLike = {
          getItemAsync: async (k) => {
            totalCalls += 1;
            return baseline.map.get(k) ?? null;
          },
          setItemAsync: async (k, v) => {
            totalCalls += 1;
            baseline.map.set(k, v);
          },
          deleteItemAsync: async (k) => {
            totalCalls += 1;
            baseline.map.delete(k);
          },
        };
        const countingAdapter = createSecureStoreAdapter(countingStore);
        if (nextOp.kind === 'set' && nextOp.value !== null) {
          await countingAdapter.setItem(KEY, nextOp.value);
        } else {
          await countingAdapter.removeItem(KEY);
        }

        // Now exhaustively inject a crash BEFORE each call step 1..totalCalls.
        for (let crashAt = 1; crashAt <= totalCalls; crashAt += 1) {
          const map = new Map(initialSnapshot);
          const trace: string[] = [];
          let step = 0;

          const crashingStore: SecureStoreLike = {
            getItemAsync: async (k) => {
              step += 1;
              if (step === crashAt) throw new SimulatedCrash();
              trace.push(`getItemAsync("${k}")`);
              return map.get(k) ?? null;
            },
            setItemAsync: async (k, v) => {
              step += 1;
              if (step === crashAt) throw new SimulatedCrash();
              trace.push(`setItemAsync("${k}", ${summarizeSessionValue(v)})`);
              map.set(k, v);
            },
            deleteItemAsync: async (k) => {
              step += 1;
              if (step === crashAt) throw new SimulatedCrash();
              trace.push(`deleteItemAsync("${k}")`);
              map.delete(k);
            },
          };

          const adapter = createSecureStoreAdapter(crashingStore);
          try {
            if (nextOp.kind === 'set' && nextOp.value !== null) {
              await adapter.setItem(KEY, nextOp.value);
            } else {
              await adapter.removeItem(KEY);
            }
          } catch (err) {
            if (!(err instanceof SimulatedCrash)) throw err;
          }

          // After restart, read via a clean adapter over the persisted map.
          const recovered = await createSecureStoreAdapter(createMemoryStore(map).store).getItem(KEY);
          const allowed = new Set<string | null>([init.value, nextOp.value, null]);
          if (!allowed.has(recovered)) {
            findings.push(
              [
                `Transition ${init.label} -> ${nextOp.label}, crash before store call #${crashAt}:`,
                formatTrace(trace),
                `  -> CRASH before call #${crashAt}`,
                `  -> Restart getItem("${KEY}") returned TORN value: ${summarizeSessionValue(recovered)}`,
                `     (expected old ${summarizeSessionValue(init.value)}, new ${summarizeSessionValue(nextOp.value)}, or null)`,
              ].join('\n')
            );
            break; // Shortest counterexample for this transition.
          }
        }
      }
    }

    if (findings.length > 0) {
      throw new Error(
        `P3 crash-atomicity violated in ${findings.length} transition(s):\n\n${findings.join('\n\n')}`
      );
    }
  });

  it('P4: concurrency interleaving — concurrent setItem || getItem never returns a torn read', async () => {
    const prevVal = makeLabeledValue('A', SECURE_STORE_CHUNK_BYTES + 200);
    const nextVal = makeLabeledValue('B', SECURE_STORE_CHUNK_BYTES + 200);

    // Prepare initial 2-chunk state.
    const seed = createMemoryStore();
    await createSecureStoreAdapter(seed.store).setItem(KEY, prevVal);
    const initialSnapshot = new Map(seed.map);

    // Exhaustively test every interleaving where getItem starts after k steps of setItem (k = 0..4)
    // and runs atomically or interleaved step-by-step.
    let counterexample: string | null = null;

    // Explore all schedules of length up to 12 where writer (W) and reader (R) advance one store call at a time.
    const runSchedule = async (schedule: Array<'W' | 'R'>) => {
      const map = new Map(initialSnapshot);
      const trace: string[] = [];

      const waiters: Record<'W' | 'R', Array<() => void>> = { W: [], R: [] };
      const done: Record<'W' | 'R', boolean> = { W: false, R: false };

      const waitTurn = (actor: 'W' | 'R') =>
        new Promise<void>((resolve) => {
          waiters[actor].push(resolve);
        });

      const makeActorStore = (actor: 'W' | 'R'): SecureStoreLike => ({
        getItemAsync: async (k) => {
          await waitTurn(actor);
          const v = map.get(k) ?? null;
          trace.push(`${actor}: getItemAsync("${k}") -> ${v === null ? 'null' : `${utf8Bytes(v)}B`}`);
          return v;
        },
        setItemAsync: async (k, v) => {
          await waitTurn(actor);
          trace.push(`${actor}: setItemAsync("${k}", ${summarizeSessionValue(v)})`);
          map.set(k, v);
        },
        deleteItemAsync: async (k) => {
          await waitTurn(actor);
          trace.push(`${actor}: deleteItemAsync("${k}")`);
          map.delete(k);
        },
      });

      const writerPromise = createSecureStoreAdapter(makeActorStore('W'))
        .setItem(KEY, nextVal)
        .finally(() => {
          done.W = true;
        });
      const readerPromise = createSecureStoreAdapter(makeActorStore('R'))
        .getItem(KEY)
        .finally(() => {
          done.R = true;
        });

      const flushMicrotasks = async () => {
        for (let i = 0; i < 6; i += 1) {
          await Promise.resolve();
        }
      };

      await flushMicrotasks();

      for (const actor of schedule) {
        if (waiters[actor].length > 0) {
          const next = waiters[actor].shift()!;
          next();
          await flushMicrotasks();
        }
      }

      // Drain any remaining steps deterministically.
      let guard = 0;
      while ((!done.W || !done.R) && guard < 30) {
        guard += 1;
        const w = waiters.W.shift();
        if (w) w();
        const r = waiters.R.shift();
        if (r) r();
        await flushMicrotasks();
      }

      await writerPromise;
      const readValue = await readerPromise;
      const allowed = new Set<string | null>([prevVal, nextVal, null]);
      if (!allowed.has(readValue)) {
        counterexample = [
          `Interleaving [${schedule.join(',')}] on 2-chunk overwrite produced TORN read:`,
          formatTrace(trace),
          `  -> Reader getItem("${KEY}") returned: ${summarizeSessionValue(readValue)}`,
          `     (expected old ${summarizeSessionValue(prevVal)}, new ${summarizeSessionValue(nextVal)}, or null)`,
        ].join('\n');
      }
    };

    // Enumerate all 2^8 = 256 interleaving prefixes of length 8.
    for (let mask = 0; mask < 256 && !counterexample; mask += 1) {
      const schedule: Array<'W' | 'R'> = [];
      for (let bit = 0; bit < 8; bit += 1) {
        schedule.push((mask & (1 << bit)) !== 0 ? 'W' : 'R');
      }
      await runSchedule(schedule);
    }

    if (counterexample) {
      throw new Error(`P4 concurrency interleaving violated:\n\n${counterexample}`);
    }
  });
});
