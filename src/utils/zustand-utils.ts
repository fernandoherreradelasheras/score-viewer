import { StoreApi, UseBoundStore } from 'zustand';


export function createSelectors<T extends object>(
  store: UseBoundStore<StoreApi<T>>
) {
  const storeWithSelectors = store as typeof store & {
    use: { [K in keyof T]: () => T[K] }
  };

  storeWithSelectors.use = {} as { [K in keyof T]: () => T[K] };

  type KeysOfStore = keyof T;
  const keys = Object.keys(store.getState()) as unknown as KeysOfStore[];

  for (const key of keys) {
    // @ts-ignore - We know this is safe because we're iterating over the keys
    storeWithSelectors.use[key] = () => store((s) => s[key]);
  }

  return storeWithSelectors;
}

