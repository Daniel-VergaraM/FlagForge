# @flagforge/sdk-js

Official JavaScript/TypeScript SDK for [FlagForge](https://github.com/Daniel-VergaraM/FlagForge), a feature flag platform. Evaluates flags against the FlagForge Evaluator service, with local LRU caching and automatic fallback to default values when the evaluator is unreachable.

## Install

```sh
pnpm add @flagforge/sdk-js
```

## Usage

```ts
import { createClient } from '@flagforge/sdk-js';

const client = createClient({
  sdkKey: 'your-sdk-key',
  evaluatorUrl: 'https://evaluator.example.com',
  defaults: { 'new-checkout': false },
});

const enabled = await client.isEnabled('new-checkout', { userId: 'user-123' });

const variant = await client.getVariant('pricing-experiment', { userId: 'user-123' });

const result = await client.evaluate('new-checkout', { userId: 'user-123' });
// result.enabled, result.variant, result.metadata

// Optional: keep the cache warm in the background
client.startPolling(['new-checkout', 'pricing-experiment']);
// client.stopPolling();

// Release resources when done (e.g. on process shutdown)
client.close();
```

### Configuration (`createClient` options)

| Option | Required | Default | Description |
|---|---|---|---|
| `sdkKey` | yes | — | Authentication key for the Evaluator service |
| `evaluatorUrl` | yes | — | Base URL of the Evaluator service |
| `defaults` | no | `{}` | Fallback boolean per flag key if the evaluator is unreachable |
| `defaultVariants` | no | `{}` | Fallback variant per flag key |
| `cacheTtlMs` | no | `30000` | Local cache entry TTL |
| `cacheMaxSize` | no | `1000` | Max entries in the local LRU cache |
| `timeoutMs` | no | `5000` | Per-request timeout to the evaluator |
| `pollingIntervalMs` | no | `60000` | Interval used by `startPolling` |

See the [FlagForge monorepo](https://github.com/Daniel-VergaraM/FlagForge) for the rest of the platform (API, evaluator, React bindings).
