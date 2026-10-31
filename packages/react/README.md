# @flagforge/react

React bindings for the [FlagForge](https://github.com/Daniel-VergaraM/FlagForge) SDK. Provides a provider and hooks to evaluate feature flags in React components, with live updates pushed over SSE.

## Install

```sh
pnpm add @flagforge/react @flagforge/sdk-js
```

Requires React and React DOM `>=18`.

## Usage

```tsx
import { FlagForgeProvider, useFlag } from '@flagforge/react';

function App() {
  return (
    <FlagForgeProvider
      config={{
        sdkKey: 'your-sdk-key',
        evaluatorUrl: 'https://evaluator.example.com',
      }}
    >
      <CheckoutButton />
    </FlagForgeProvider>
  );
}

function CheckoutButton() {
  const { enabled, value, loading, error } = useFlag('new-checkout', { userId: 'user-123' });

  if (loading) return null;
  return enabled ? <NewCheckout variant={value} /> : <OldCheckout />;
}
```

`config` accepts the same options as `createClient` from `@flagforge/sdk-js` (`sdkKey`, `evaluatorUrl`, `defaults`, `defaultVariants`, `cacheTtlMs`, `cacheMaxSize`, `timeoutMs`, `pollingIntervalMs`).

### API

- `FlagForgeProvider` — wraps your app, creates the underlying `FlagForgeClient`, and listens for flag-change events from the evaluator's SSE stream.
- `useFlagForge()` — access the raw `{ client, flags, ready, error }` context value. Must be used inside `FlagForgeProvider`.
- `useFlag(key, context?)` — evaluates a single flag and returns `{ enabled, value, loading, error }`. Re-evaluates on an interval and whenever the evaluator pushes a change for that key.
- `useFlags()` — returns `{ flags, loading, error }`. Note: the underlying SDK does not yet expose a flag-listing API, so `flags` is currently always empty.

See the [FlagForge monorepo](https://github.com/Daniel-VergaraM/FlagForge) for the rest of the platform.
