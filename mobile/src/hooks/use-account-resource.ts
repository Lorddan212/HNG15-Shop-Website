import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from '@/lib/api-client';

/** Memory only. Ignore requests belonging to a blurred screen or a previous account. */
export function useAccountResource<T>(userId: string | null, load: (id: string) => Promise<T>, resourceKey = '') {
  const ownerKey = userId ? userId + ':' + resourceKey : null;
  const [state, setState] = useState<{ owner: string | null; data?: T; error: ApiError | null; loading: boolean }>({
    owner: null, error: null, loading: true,
  });
  const active = useRef<symbol | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const scope = active.current;
    if (!scope || !userId) return;
    const ticket = ++request.current;
    setState(previous => ({ owner: ownerKey, data: previous.owner === ownerKey ? previous.data : undefined, error: null, loading: true }));
    try {
      const data = await load(userId);
      if (active.current === scope && request.current === ticket) setState({ owner: ownerKey, data, error: null, loading: false });
    } catch (error) {
      if (active.current === scope && request.current === ticket) setState({
        owner: ownerKey, error: error instanceof ApiError ? error : new ApiError('Unable to load your orders. Please try again.'), loading: false,
      });
    }
  }, [load, userId, ownerKey]);
  useFocusEffect(useCallback(() => {
    active.current = Symbol('account-screen');
    void reload();
    return () => { active.current = null; request.current += 1; };
  }, [reload]));
  return {
    data: state.owner === ownerKey ? state.data : undefined,
    error: state.owner === ownerKey ? state.error : null,
    loading: Boolean(userId) && (state.owner !== ownerKey || state.loading),
    reload,
  };
}
