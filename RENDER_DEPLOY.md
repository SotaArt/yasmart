# Deploy to Render

1. Go to https://render.com -> New -> Web Service -> Connect GitHub
2. Select repo: `SotaArt/yasmart`
3. Runtime: Docker
4. Branch: `main`
5. Add Environment Variables:

```
NODE_ENV=production
PORT=8080
PUBLIC_DIR=/app/artifacts/smart-home/dist/public
DATA_DIR=/app/data
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=<generate strong>
SESSION_SECRET=<openssl rand -hex 32>
TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
COOKIE_SECURE=true
CORS_ORIGIN=https://<your-app>.onrender.com
```

6. Create Web Service and wait for build/deploy.

Notes:
- Server-side encrypted token vault is used (AES-256-GCM). Token stored in `data/settings.json`.
- Panel password required in production.
- First login uses DASHBOARD_USER/PASSWORD.
- OAuth link in token form uses Client ID to generate `https://oauth.yandex.ru/authorize?...`.
