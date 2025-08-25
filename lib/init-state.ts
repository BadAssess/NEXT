'use client';

export type InitStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface InitState {
  fhe: InitStatus;
  ipfs: InitStatus;
  overall: InitStatus;
  errors: Record<string, string>;
}

let initState: InitState = {
  fhe: 'pending',
  ipfs: 'pending', 
  overall: 'pending',
  errors: {}
};

const listeners = new Set<(state: InitState) => void>();

export function getInitState(): InitState {
  return { ...initState };
}

export function subscribeInitState(listener: (state: InitState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateInitState(updates: Partial<InitState>): void {
  const prevState = { ...initState };
  
  initState = {
    ...initState,
    ...updates,
    errors: { ...initState.errors, ...updates.errors }
  };

  if (initState.fhe === 'error') {
    initState.overall = 'error';
  } else if (initState.fhe === 'ready' && initState.ipfs === 'ready') {
    initState.overall = 'ready';
  } else if (initState.fhe === 'loading' || initState.ipfs === 'loading') {
    initState.overall = 'loading';
  } else {
    initState.overall = 'pending';
  }

  const stateChanged = JSON.stringify(prevState) !== JSON.stringify(initState);
  if (stateChanged) {
    listeners.forEach(listener => listener({ ...initState }));
  }
}

export function setFheStatus(status: InitStatus, error?: string): void {
  updateInitState({
    fhe: status,
    errors: error ? { fhe: error } : initState.errors
  });
}

export function setIpfsStatus(status: InitStatus, error?: string): void {
  updateInitState({
    ipfs: status,
    errors: error ? { ipfs: error } : initState.errors
  });
}

export function resetInitState(): void {
  initState = {
    fhe: 'pending',
    ipfs: 'pending',
    overall: 'pending', 
    errors: {}
  };
  listeners.forEach(listener => listener({ ...initState }));
}

export function isReadyFor(feature: 'encryption' | 'ipfs' | 'all'): boolean {
  if (initState.fhe === 'error') {
    return false;
  }
  
  switch (feature) {
    case 'encryption':
      return initState.fhe === 'ready';
    case 'ipfs':
      return initState.ipfs === 'ready';
    case 'all':
      return initState.overall === 'ready';
    default:
      return false;
  }
}
