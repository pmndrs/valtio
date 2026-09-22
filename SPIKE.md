# Valtio v3 snapshot boundary spikes

## Status

This is an architectural spike, not a proposed merge of all these changes.
The experiments started from `v3-o1-subscription` at `2800d00`. That branch
and the five spike branches now include the v3 naming update at `fb594a1`;
their architectural differences remain separate.

The strongest candidate is `spike-v3-versioned-collection-index`, in
`/tmp/valtio-boundary-spikes.fRekVy/versioned`.

It demonstrates a boundary with no React or collection use of
`unstable_getInternalStates` or `unstable_replaceInternalFunction`.
The existing dependencies in `applyChanges`, `deepClone`, and `deepProxy`
are unchanged; this does not claim to have eliminated those APIs repository-wide.

## Recommended boundary

| Layer         | Owns                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| vanilla       | Mutable proxies, snapshots, subscriptions, optional direct-key revisions                    |
| react         | Snapshot read wrappers, observed source relationships, render/committed usage and filtering |
| vanilla/utils | Collection indexes represented as snapshot-able data, with a private version counter        |

Plain snapshots have no library-added reverse reference to a mutable source.
Neither importing React nor importing the collection utilities changes snapshot creation.
No WeakRef, new core get trap, collection registry, or snapshot-creation hook is used.

React starts with the known pair `state` and `snapshot(state)`. A child is
associated only when its cached snapshot matches the value being read (or a
previously established React read binding supplies that association). If an
old, previously unused child cannot be associated, its parent-key read is
rechecked and React obtains a current snapshot.

Associations belong to individual React read records, including the parent
key. A global association from a plain snapshot object to its former source
is insufficient: the same snapshot may later be stored in a ref.

Replacement checks compare the live references along observed paths. Vanilla
still sends detachment notifications to old descendants; React does not need
a global detachment-version registry to interpret them.

The tracker reuses read records for memoized descendants and routes late reads
to active subscriptions. It keeps the existing concurrent-render behavior.
That bookkeeping has not been removed merely to make a shorter spike.

## API proposals, not settled decisions

1. `isProxyObject(value)`: a membership query, not a TypeScript guard that
   would wrongly exclude non-proxy objects in its false branch.
2. `subscribe(state, callback, { keys: ['child'], recursive: false })`:
   direct property writes only. The existing recursive default is retained.
3. `getVersion(state, key)`: an opaque direct-key revision for change checks.
   This is one possible API shape. Revision storage is allocated lazily for
   queried keys, rather than exposing implementation maps to consumers.

The key revision is needed for getter/setter pairs that mutate opaque values
such as Date or ref contents. It closes the render-to-subscribe gap without
re-evaluating a getter or exposing a getter-specific version map. Read-only
getters continue to rely on their actual tracked dependencies.

Initial keys on a target share one subscription. Keys discovered later can
be added individually without rebuilding the existing subscriptions.

## Decided: explicit copies of read snapshots

The shared unwrapping symbol has been removed. Assigning React read proxies
directly to state is now unsupported, with no runtime detection. The explicit
copy path is `destination.child = deepClone(tracked.child)`, including cloning
the whole payload when it contains nested read snapshots. `applyChanges` is
unchanged and is not an unwrapping alternative.

Cloning itself performs tracked reads. Later operations on the copy do not
reach the React tracker; ref values remain shared. The migration guide and
useSnapshot API documentation describe this designed limitation.

The preferred name for an explicit React-only unwrapping helper is
`getUntracked`. That optional export has not been implemented here.

## Collection variants

Both variants keep a native Map for live lookup/iteration and store historical
index information in ordinary data that vanilla can snapshot.

- `spike-v3-collection-state`: fully proxied positions, key entries and size.
  It passes the original suite but adds several proxy writes per insertion.
- `spike-v3-versioned-collection-index`: opaque index entries (numbers and
  refs) are updated privately, followed by one proxied version write.
  Snapshot methods read the version before using the captured index.
  This is analogous to the existing epoch mechanism, but the index itself is
  snapshot-able; no external snapshot initialization is needed.

The versioned representation preserves O(1) live lookup and ordinary
insert/delete scaling. It is not a persistent immutable Map copied on every
insertion. Snapshot indexes remain historical through nested/transparent
wrappers, deletion, reinsertion and mixed key types.

Collection operations are not being made atomic in this spike. The existing
multi-write operation model remains; the planned always-sync/batch work is
separate.

## Rejected approaches and reproduced failures

- Merely replacing global snapshot registration with a per-hook
  snapshot-to-source map: most tests pass, but a previously observed snapshot
  later stored as a ref can be mistaken for its former source. An unrelated
  layout-effect write then causes a render loop. The read-record candidate
  passes that regression.
- Comparing getter/setter results instead of keeping key revisions:
  `get selected() { return { count: this.count } }` can also cause a render
  loop after an unrelated write. It additionally re-evaluates expensive
  accessors during consistency checks. Both failures were reproduced before
  switching the candidate to key revisions.
- Copying a native Map on every structural mutation would be very small code,
  but makes repeated insertion quadratic. This was ruled out by inspection,
  not presented as a completed benchmarked implementation.

Intermediate branches remain available for comparison:
`spike-v3-local-snapshot-pairing`,
`spike-v3-subscription-boundary`,
`spike-v3-collection-state`, and `spike-v3-clean-boundary`.

## Validation

- Full candidate run after removing the unwrapping protocol: 718 passed,
  1 existing skipped; all 46 test files were collected.
- Before that removal, React 18.3.1 compatibility: 407 passed, 4 skipped,
  covering React tests and the existing proxyMap/proxySet suites.
- After removal, all 48 focused cloning, boundary and optimization tests also
  pass on React 18.3.1.
- Type checking, formatting, linting (existing warnings only), and build pass.
  A compiled-module smoke test also passes with WeakRef unavailable.
- Deterministic subscription tests use 10 and 1,000 children: only one
  direct leaf-key listener is installed, with zero recursive listeners.
- Existing memory, suspended-render, late-descendant-read, memo, getter,
  ref, replacement and operation regressions are retained.
- Added boundary tests cover module import behavior, historical refs,
  explicit cloning of read snapshots, key revisions, and collection key order.

The two existing getter-baseline instrumentation assertions change by one
cached child snapshot query per child. Their render-count assertions are
unchanged; the additional work is linear, not an N-by-N subscription setup.

Some internal-registry tests were updated because the registries were removed.
The shared-detachment test now checks actual once-only notifications rather
than spying on an implementation map.

This is not a claim that passing tests prove the architecture has no edge cases.
No fresh-context reviewer agents were used for this task.

## Local performance evidence

`/tmp/valtio-boundary-spikes.fRekVy/benchmark.mjs` compares compiled production
modules against `2800d00`. Results are medians of seven measured samples after
two warmup samples, interleaving variants. They are local microbenchmarks,
not cross-platform guarantees.

Representative versioned-index ratios from the first three-way run:

| Workload                              | Candidate / baseline |
| ------------------------------------- | -------------------: |
| Insert 3,000 Map keys                 |                 1.35 |
| Update existing Map values            |                 0.82 |
| Live Map get                          |                 0.75 |
| Snapshot after value-only updates     |                 0.66 |
| Snapshot after structural insertion   |                 1.47 |
| SSR indexed reads over 1,000 children |                 0.99 |
| SSR changed leaf among 1,000 siblings |                 0.61 |

Treat small timing differences cautiously. The meaningful remaining tradeoff
is collection structural work: the ordinary-data index costs more than cloning
a native Map in a snapshot hook. Value-only snapshots can reuse the index
instead of cloning it.

The SSR benchmarks measure snapshot/read-tracking work, not subscription setup.
The listener-count tests separately establish the leaf-registration property.

## Recommendation

Use the read-record boundary as the next design candidate. It removes the
global integration hooks rather than relocating them, and does not depend on
the internal registries slated for removal.

This is primarily a boundary simplification, not a large code-size reduction.
React is about 55 lines shorter; total product code is nearly unchanged.
Collection snapshot ownership is now explicit within the utilities instead
of relying on global hooks.

Review the narrow API proposals and the collection representation
before transplanting this work to `v3-o1-subscription`. The snapshot semantics,
replacement semantics, getter dependency model and concurrent guarantees do
not need to be weakened for this candidate. Direct read-proxy assignment is
the explicit exception agreed after the initial spike; it requires cloning.
