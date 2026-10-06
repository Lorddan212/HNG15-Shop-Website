/** Browser-independent OAuth coordinator, tested without real users or tokens. */
export const MOBILE_CALLBACK = 'foliovale://auth/callback';
export const PENDING_AUTH_KEY = 'foliovale.oauth.pending.v1';
const MAX_AGE = 15 * 60 * 1000;

export class GoogleAuthError extends Error {
  constructor(message: string) { super(message); this.name = 'GoogleAuthError'; }
}

type Pending = { flowId: string; startedAt: number };
type Dependencies = {
  supabaseUrl: string;
  storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
  authorize: () => Promise<{ url: string; flowId: string }>;
  exchange: (code: string, flowId: string) => Promise<void>;
  openBrowser: (url: string, redirect: string) => Promise<{ type: string; url?: string }>;
  now?: () => number;
};

function parseCallback(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new GoogleAuthError('This sign-in link is invalid. Please start again.'); }
  if (url.protocol !== 'foliovale:' || url.hostname !== 'auth' || url.pathname !== '/callback' || url.port || url.username || url.password || url.hash) {
    throw new GoogleAuthError('This sign-in link is not a FolioVale callback. Please start again.');
  }
  return url;
}

export function createGoogleAuthFlow({ supabaseUrl, storage, authorize, exchange, openBrowser, now = Date.now }: Dependencies) {
  let starting: Promise<void> | null = null;
  let completing: Promise<void> | null = null;
  let completedCount = 0;
  // Both the browser result and the Router callback can receive the same code.
  // Keep only a small in-memory deduplication cache; never persist callback URLs.
  const handled = new Map<string, Promise<void>>();

  async function readPending(): Promise<Pending> {
    let pending: Pending;
    try { pending = JSON.parse(await storage.getItem(PENDING_AUTH_KEY) ?? 'null'); }
    catch { throw new GoogleAuthError('Your sign-in could not be restored. Please start again.'); }
    if (!pending || !/^[a-zA-Z0-9_-]{8,64}$/.test(pending.flowId) || !Number.isFinite(pending.startedAt)
      || now() - pending.startedAt < 0 || now() - pending.startedAt > MAX_AGE) {
      throw new GoogleAuthError('This sign-in attempt is missing or expired. Please start again.');
    }
    return pending;
  }

  function complete(value: string): Promise<void> {
    let url: URL;
    try { url = parseCallback(value); } catch (error) { return Promise.reject(error); }
    const existing = handled.get(url.href);
    if (existing) return existing;
    if (completing) return Promise.reject(new GoogleAuthError('Another sign-in is being completed. Please wait.'));
    const result = (async () => {
      const pending = await readPending();
      try {
        if (url.searchParams.has('error') || url.searchParams.has('error_description')) {
          throw new GoogleAuthError(url.searchParams.get('error') === 'access_denied'
            ? 'Google sign-in was not approved. You can try again.'
            : 'Google could not complete sign-in. Please try again.');
        }
        const codes = url.searchParams.getAll('code');
        const code = codes[0];
        if (codes.length !== 1 || !code || code.length > 2048 || /\s/.test(code)
          || url.searchParams.has('access_token') || url.searchParams.has('refresh_token')) {
          throw new GoogleAuthError('The sign-in response is incomplete or invalid. Please start again.');
        }
        try { await exchange(code, pending.flowId); }
        catch { throw new GoogleAuthError('Your sign-in could not be verified. The link may have expired. Please try again.'); }
      } finally {
        await storage.removeItem(PENDING_AUTH_KEY);
      }
    })();
    completing = result;
    handled.set(url.href, result);
    if (handled.size > 8) handled.delete(handled.keys().next().value!);
    void result.then(() => { completing = null; completedCount += 1; }, () => { completing = null; });
    return result;
  }

  function signIn(): Promise<void> {
    if (starting) return starting;
    if (completing) return Promise.reject(new GoogleAuthError('Please wait for your current sign-in to finish.'));
    const previouslyCompleted = completedCount;
    starting = (async () => {
      try {
        const result = await authorize();
        const url = new URL(result.url);
        const project = new URL(supabaseUrl);
        // Do not open a different host or a downgraded/plain PKCE challenge.
        if (url.protocol !== 'https:' || url.origin !== project.origin || url.pathname !== '/auth/v1/authorize'
          || url.username || url.password || url.hash || url.searchParams.get('provider') !== 'google'
          || url.searchParams.get('redirect_to') !== MOBILE_CALLBACK
          || url.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256'
          || !/^[a-zA-Z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '')
          || !/^[a-zA-Z0-9_-]{8,64}$/.test(result.flowId)) {
          throw new GoogleAuthError('Secure Google sign-in could not be prepared. Please restart the app and try again.');
        }
        await storage.setItem(PENDING_AUTH_KEY, JSON.stringify({ flowId: result.flowId, startedAt: now() }));
        const browser = await openBrowser(result.url, MOBILE_CALLBACK);
        if (browser.type === 'success' && browser.url) await complete(browser.url);
        else if (completing) await completing;
        else if (completedCount > previouslyCompleted) return;
        else throw new GoogleAuthError('Sign-in was cancelled. Tap Continue with Google when you are ready.');
      } catch (error) {
        await storage.removeItem(PENDING_AUTH_KEY).catch(() => undefined);
        if (error instanceof GoogleAuthError) throw error;
        throw new GoogleAuthError('Unable to open Google sign-in. Check your connection and try again.');
      }
    })();
    void starting.then(() => { starting = null; }, () => { starting = null; });
    return starting;
  }
  return { signIn, complete };
}
