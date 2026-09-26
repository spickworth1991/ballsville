# Ballsville Admin Login Setup

This login is completely separate from Stream Room and Supabase Auth. Admin users are stored in the existing R2 bucket under `data/admin/auth/users/`. An approved Stream Room account cannot sign in to Admin, and an approved Admin account cannot sign in to Stream Room.

## 1. Generate the admin session secret

From the project folder in PowerShell, run this as one line:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy only the long value printed by Node. Do not include the prompt, command, quotes, or any PowerShell heading.

Use a newly generated value. Do not reuse `STREAM_AUTH_SECRET`.

## 2. Add the production secret in Cloudflare

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages**.
3. Open the **ballsville** Pages project.
4. Select **Settings**.
5. Open **Variables and Secrets**.
6. Under **Production**, select **Add**.
7. Choose **Secret** (encrypted), not plain text.
8. Set the variable name exactly to `ADMIN_AUTH_SECRET`.
9. Paste the generated value as the variable value.
10. Save it.

Important: changing `ADMIN_AUTH_SECRET` later immediately signs every Admin user out. It does not sign Stream Room users out because the two systems use different cookies and secrets.

## 3. Confirm the existing R2 binding

The Admin login reuses the same R2 bucket already used by the site and Stream Room.

1. In the same Pages project, open **Settings** and then **Bindings**.
2. Confirm an R2 bucket binding exists with the variable name `ADMIN_BUCKET` or `admin_bucket`.
3. Do not create a second bucket if this binding already points to the existing Ballsville bucket.

The bucket's actual Cloudflare name does not need to match the variable name.

## 4. Configure approval email delivery

Admin access requests are always sent to `contact.stickypicky@gmail.com` for approval.

The code reuses these Stream Room email settings when present:

- `CLOUDFLARE_ACCOUNT_ID`
- `STREAM_EMAIL_API_TOKEN`

If those are already working for Stream Room, no additional email API token is required. Optionally, you can add a separate encrypted `ADMIN_EMAIL_API_TOKEN`; when present, Admin uses it instead.

Optional production overrides:

- `ADMIN_APPROVAL_FROM_EMAIL` = a separately authorized sender, if desired
- `ADMIN_PUBLIC_ORIGIN` = `https://www.theballsvillegame.com`

If `ADMIN_APPROVAL_FROM_EMAIL` is omitted, Admin automatically reuses `STREAM_APPROVAL_FROM_EMAIL` and then falls back to `stream@theballsvillegame.com`. Any separately configured From address must be allowed by the same Cloudflare Email Sending setup used for Stream Room.

## 5. Deploy the site

Deploy after the variables are saved. Cloudflare Pages variables do not change an already-built deployment, so trigger a new production deployment if Cloudflare does not do so automatically.

## 6. Create the first Admin account

1. Open `https://www.theballsvillegame.com/admin/login`.
2. Select **Create account**.
3. Enter a username.
4. Optionally enter your email address.
5. Enter and confirm a password of at least 12 characters.
6. Submit the request.
7. Open the approval email sent to `contact.stickypicky@gmail.com`.
8. Open the private review link in that email.
9. Verify the username and select **Approve access**.
10. Return to `/admin/login` and sign in with the approved username and password.

The old Supabase account is not copied. Creating this new account is expected.

## 7. Test locally

Local Admin auth must run through Wrangler because `npm run dev` alone does not provide Pages Functions, R2 bindings, or cookies from those functions.

1. Create or update `.dev.vars` in the project root. It is git-ignored.
2. Add:

```dotenv
ADMIN_AUTH_SECRET=paste-a-separate-generated-secret-here
ADMIN_APPROVAL_DEV_MODE=true
ADMIN_PUBLIC_ORIGIN=http://localhost:8788
```

3. Start Next.js in the first PowerShell window:

```powershell
npm run dev
```

4. Start the Pages proxy in a second PowerShell window:

```powershell
npm run proxy
```

5. Open `http://localhost:8788/admin/login`, not port 3000.
6. Create an account. In local development mode, the page response provides the review link instead of sending email.
7. Open that review link, approve the account, and sign in.

The local R2 data is stored under `.wrangler/state`, so it is separate from the production account record.

## Variables summary

Required:

- `ADMIN_AUTH_SECRET` - encrypted secret; unique to Admin
- `ADMIN_BUCKET` or `admin_bucket` - the existing R2 bucket binding
- `CLOUDFLARE_ACCOUNT_ID` - already used by Stream Room email
- `STREAM_EMAIL_API_TOKEN` or `ADMIN_EMAIL_API_TOKEN` - encrypted Cloudflare email API token

Recommended:

- `ADMIN_APPROVAL_FROM_EMAIL`
- `ADMIN_PUBLIC_ORIGIN`

Local only:

- `ADMIN_APPROVAL_DEV_MODE=true`

Do not enable `ADMIN_APPROVAL_DEV_MODE` in production because it returns the private approval link directly to the requester.

## Supabase settings

Admin authentication no longer uses `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`, or a Supabase login session. Those auth-only allow-list variables can be removed after this deployment is confirmed.

Do not remove the general Supabase data variables yet. The Gauntlet seed editor still stores its data in Supabase, and the optional Hall of Fame importer can read legacy Supabase content. They now run through cookie-protected server endpoints and do not use a Supabase user login to decide who is an administrator.

For the Gauntlet seed editor, keep these production secrets configured in Cloudflare Pages:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` - encrypted secret; never expose it as a `NEXT_PUBLIC_` variable
