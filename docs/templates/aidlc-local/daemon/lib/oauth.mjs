// Linear OAuth client-credentials tokens (actor=app). Linear: POST <oauthUrl>/token with
// grant_type=client_credentials; 30-day tokens, no refresh token — mint again on expiry or a 401.
// The app must have "client credentials" enabled in its Linear settings.

export class ClientCredentials {
  constructor({ oauthUrl, clientId, clientSecret, scopes, fetchImpl = fetch, now = () => Date.now() }) {
    if (!clientId || !clientSecret) throw new Error('OAuth client id and secret are required');
    Object.assign(this, { oauthUrl: oauthUrl.replace(/\/$/, ''), clientId, clientSecret, scopes, fetch: fetchImpl, now });
    this.current = null;
  }

  /** A fresh token, independent of the cached one (per-run agent tokens). */
  async mint() {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret, scope: this.scopes });
    const res = await this.fetch(`${this.oauthUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30e3),
    });
    const text = await res.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`Linear OAuth token: HTTP ${res.status}, not JSON`);
    }
    if (!res.ok || !j.access_token) throw new Error(`Linear OAuth token: ${j.error_description || j.error || `HTTP ${res.status}`}`);
    return { token: j.access_token, expiresAt: this.now() + (Number(j.expires_in) || 86400) * 1000, scope: j.scope || this.scopes };
  }

  /** Cached token for this process; re-minted an hour before expiry, or when forced (after a 401). */
  async token(force = false) {
    if (force || !this.current || this.current.expiresAt - this.now() < 3600e3) this.current = await this.mint();
    return this.current.token;
  }

  async revoke(token) {
    const res = await this.fetch(`${this.oauthUrl}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
      signal: AbortSignal.timeout(30e3),
    });
    return res.status === 200;
  }
}

/** Personal API keys (lin_api_…) go in Authorization as-is; OAuth access tokens as Bearer. */
export const authHeader = (key) => (key.startsWith('lin_api_') || key.startsWith('Bearer ') ? key : `Bearer ${key}`);
