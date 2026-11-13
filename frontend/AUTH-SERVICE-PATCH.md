# auth.service.ts  (add these two pieces)

1) method:
```ts
  /** extend the session silently each time the app opens */
  refreshSession(): void {
    if (!this.getToken()) return;
    this.http.post<any>(`${this.apiUrl}/refresh`, {}).subscribe({
      next: (res) => {
        const token = res?.token ?? res?.data?.token;
        if (token) { localStorage.setItem('mfm_token', token); this.tokenSignal?.set?.(token); }
      },
      error: () => {} // ignore; 401 handling is done by the interceptor
    });
  }
```
(use your own names for apiUrl / getToken / token signal)

2) at the end of the constructor:
```ts
    if (typeof window !== 'undefined') setTimeout(() => this.refreshSession(), 1500);
```

# app.routes.ts
Add `canActivate: [authGuard]` to the `portal` route.
