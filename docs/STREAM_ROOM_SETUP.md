# Ballsville Stream Room — exact setup guide

This guide is written for this specific project. Use the names and values exactly as shown unless a step says to paste a generated value.

## Values already decided for this project

| Setting | Exact value |
| --- | --- |
| Cloudflare Pages project | `ballsville` |
| Website domain | `theballsvillegame.com` |
| Canonical website URL | `https://www.theballsvillegame.com` |
| Approval recipient | `contact.stickypicky@gmail.com` |
| Approval sender | `stream@theballsvillegame.com` |
| Existing R2 bucket | `admin` |
| Existing Pages R2 binding | `ADMIN_BUCKET` |
| GitHub repository | `spickworth1991/ballsville` |
| GitHub branch | `main` |
| Stream workflow file | `update-stream-data.yml` |

Do not paste API tokens, secret keys, or `STREAM_AUTH_SECRET` into this file, source code, Discord, or a support message. Put them only in the encrypted secret fields described below.

## What is required

For account requests, email approval, login, and Injury Report, complete sections 1–7.

Trade Talks also needs the GitHub workflow configuration in sections 8–10. If the existing leaderboard workflow already uploads to R2 successfully, most of the GitHub R2 secrets in section 10 already exist and should be reused.

No new R2 bucket and no D1 database are required.

## 1. Verify the approval destination — completed

You already added `contact.stickypicky@gmail.com` as a Cloudflare Email Routing destination.

Double-check its status:

1. Sign in to the Cloudflare dashboard.
2. Select the Cloudflare account that owns `theballsvillegame.com`.
3. Open **Compute > Email Service > Email Routing**.
4. Open **Destination Addresses**.
5. Find `contact.stickypicky@gmail.com`.
6. Its status must say **Verified**. If it says **Pending**, open the verification message in Gmail and select **Verify email address**.

Only this fixed, verified address receives Stream Room approval messages. Sending to a verified Email Routing destination is free on Cloudflare's Free and Paid Workers plans.

## 2. Confirm Email Routing is enabled for the sending domain

The approval email comes from `stream@theballsvillegame.com`. Cloudflare permits free sends to a verified destination only when the sender uses one of the account's Email Routing domains.

1. In Cloudflare, open **Compute > Email Service > Email Routing**.
2. Select `theballsvillegame.com`.
3. Confirm Email Routing is **Enabled** or **Active**.
4. If Cloudflare displays **Enable Email Routing**, select it and allow Cloudflare to add the required DNS records.
5. Wait until the page reports that Email Routing is enabled.

You do not need to create an inbound routing rule for `stream@theballsvillegame.com`. The application only uses that address as the sender.

You also do not need Workers Paid or arbitrary-recipient Email Sending for this workflow because the only recipient is the verified Gmail address.

## 3. Copy the Cloudflare Account ID

This is an identifier, not a password.

Fastest method:

1. While signed into Cloudflare, press **Ctrl+K**.
2. Enter `Copy account ID`.
3. Select **Copy account ID** from the results.
4. Paste the value temporarily into Notepad. It should be a long hexadecimal-looking ID.

Alternative method:

1. Open **Workers & Pages**.
2. On the overview page, find **Account Details**.
3. Select the copy button beside **Account ID**.

Do not use the Zone ID. The application specifically needs the Account ID.

## 4. Create the Cloudflare email API token

Create a dedicated token instead of using the Global API Key.

1. In Cloudflare, select your profile icon.
2. Open **My Profile**.
3. Open **API Tokens**.
4. Select **Create Token**.
5. Select **Create Custom Token**.
6. For **Token name**, enter:

   ```text
   Ballsville Stream approval email
   ```

7. Under **Permissions**, add exactly one permission row:

   | Scope | Permission | Access |
   | --- | --- | --- |
   | `Account` | `Email Sending` | `Edit` |

8. Under **Account Resources**, select:

   ```text
   Include > Specific account > [the account that owns theballsvillegame.com]
   ```

9. Do not add Zone permissions.
10. Leave **Client IP Address Filtering** empty. Cloudflare Pages does not use one fixed outgoing IP address.
11. Leave **TTL** unset unless you intentionally want the approval system to stop on a particular date.
12. Select **Continue to summary**.
13. Confirm that the summary contains only **Account / Email Sending / Edit** for the correct account.
14. Select **Create Token**.
15. Copy the token immediately. Cloudflare shows it only once. New tokens commonly begin with `cfut_`.

The copied token becomes the `STREAM_EMAIL_API_TOKEN` encrypted secret in section 6. Do not use an R2 token here; R2 tokens have different permissions and will not send email.

## 5. Generate the Stream session secret

This secret signs the HttpOnly login cookies. It is not a user password.

From PowerShell in the project folder, run exactly:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the single line of output. That output becomes the `STREAM_AUTH_SECRET` encrypted secret in section 6.

Important:

- Generate it once and keep using the same value.
- **Changing or regenerating `STREAM_AUTH_SECRET` immediately logs every Stream Room user out on every device.** It does not delete approved accounts or passwords, so users can sign back in, but all current sessions become invalid.
- Do not generate a new value during a normal deployment. Only replace it intentionally if you need to invalidate every active session, such as after the secret may have been exposed.
- Do not use a normal password or reuse the Cloudflare API token.

## 6. Add the exact Cloudflare Pages variables and secrets

1. In Cloudflare, open **Workers & Pages**.
2. Select the Pages project named **ballsville**.
3. Open **Settings**.
4. Open **Variables and Secrets**. In older dashboard layouts this may be labeled **Environment variables**.
5. Add each item in the table below.
6. Add them to **Production**. If Cloudflare provides a separate Preview environment and you want preview deployments to work, add the same entries to **Preview** too.

| Name | Type | Exact value |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Text / plaintext variable | Paste the Account ID copied in section 3 |
| `STREAM_EMAIL_API_TOKEN` | **Encrypted secret** | Paste the API token created in section 4 |
| `STREAM_AUTH_SECRET` | **Encrypted secret** | Paste the random output generated in section 5 |
| `STREAM_APPROVAL_FROM_EMAIL` | Text / plaintext variable | `stream@theballsvillegame.com` |
| `STREAM_PUBLIC_ORIGIN` | Text / plaintext variable | `https://www.theballsvillegame.com` |

Save every entry. Variable names are case-sensitive; enter them exactly as shown.

> **Session warning:** After the first setup, leave `STREAM_AUTH_SECRET` unchanged. Replacing it and redeploying logs out every Stream Room user immediately. Approved accounts remain stored in R2 and can sign back in with their existing usernames and passwords.

`STREAM_USERS_JSON` is not required for newly requested accounts. Approved accounts are stored in R2. If an older `STREAM_USERS_JSON` already exists, it can remain in place for those manually configured accounts.

## 7. Verify the existing R2 binding and deploy

The application stores pending and approved accounts in the existing `admin` R2 bucket.

1. In the **ballsville** Pages project, open **Settings > Bindings**.
2. Find an **R2 bucket** binding with:

   | Field | Required value |
   | --- | --- |
   | Variable name | `ADMIN_BUCKET` |
   | R2 bucket | `admin` |

3. If that exact binding already exists, do not create a duplicate.
4. If it is missing, select **Add > R2 bucket**, enter `ADMIN_BUCKET`, select the `admin` bucket, and save it.
5. Apply the binding to Production and Preview if Cloudflare separates the environments.
6. Open the project's **Deployments** tab.
7. Redeploy the newest `main` deployment, or push the completed code so Cloudflare creates a new deployment. Pages variables and bindings do not affect an already-finished deployment until it is redeployed.

### Test account approval after deployment

1. Open `https://www.theballsvillegame.com/stream` in a private/incognito window.
2. Select **Request access**.
3. Enter a name, a username, and a password containing at least 12 characters. The requester's contact email is optional.
4. Submit the request.
5. Confirm the page says the request was sent and is waiting for approval.
6. Open `contact.stickypicky@gmail.com` and look for a message named **Stream Room access request: USERNAME**. Check Spam once if necessary.
7. Open the review link in that message.
8. Confirm the name, username, and optional contact email are correct.
9. Select **Approve access**.
10. Return to `/stream` and sign in with the requested username and password.

Opening the email link does not approve the account by itself. The separate **Approve access** button prevents email security scanners from approving requests automatically. The link is single-use and expires after 48 hours.

## 8. Configure the GitHub token used by the Trade Talks refresh button

This token lets the protected Stream Room page start only the repository's GitHub Actions workflows.

1. Sign in to GitHub as `spickworth1991`.
2. Select the profile picture > **Settings**.
3. Open **Developer settings**.
4. Open **Personal access tokens > Fine-grained tokens**.
5. Select **Generate new token**.
6. Enter these settings:

   | Field | Value |
   | --- | --- |
   | Token name | `Ballsville workflow dispatcher` |
   | Resource owner | `spickworth1991` |
   | Expiration | Choose the longest period you are comfortable maintaining; record the expiration date |
   | Repository access | `Only select repositories` |
   | Selected repository | `ballsville` |

7. Under **Repository permissions**, set:

   | Permission | Access |
   | --- | --- |
   | `Actions` | `Read and write` |

8. Leave every other repository permission at its default unless GitHub automatically adds required metadata read access.
9. Select **Generate token** and copy it immediately.
10. In Cloudflare, return to **Workers & Pages > ballsville > Settings > Variables and Secrets**.
11. Add the following to Production, and Preview if desired:

   | Name | Type | Exact value |
   | --- | --- | --- |
   | `GITHUB_REPO` | Text / plaintext variable | `spickworth1991/ballsville` |
   | `GH_WORKFLOW_TOKEN` | **Encrypted secret** | Paste the fine-grained GitHub token |
   | `STREAM_WORKFLOW_FILE` | Text / plaintext variable | `update-stream-data.yml` |
   | `STREAM_WORKFLOW_REF` | Text / plaintext variable | `main` |

12. Save and redeploy the Pages project again.

If `GITHUB_REPO` and `GH_WORKFLOW_TOKEN` already power another working Ballsville rebuild button, reuse those existing values rather than creating duplicates.

## 9. Confirm the Stream workflow exists in GitHub

After the code is pushed:

1. Open `https://github.com/spickworth1991/ballsville`.
2. Select **Actions**.
3. In the workflow list, confirm **Update Stream Data** appears.
4. Select it and confirm **Run workflow** is available with branch `main` and dataset `trades`.

The workflow file in the repository is `.github/workflows/update-stream-data.yml`.

## 10. Verify the GitHub Actions R2 secrets

These secrets let the GitHub workflow read the leaderboard snapshot and write `data/stream/trades.json` to the same existing R2 bucket.

If the existing **Update Leaderboards** GitHub Action successfully uploads data, these four secrets should already exist. Verify them before creating anything new:

1. In GitHub, open `spickworth1991/ballsville`.
2. Open **Settings > Secrets and variables > Actions**.
3. Under **Repository secrets**, confirm these names exist:

   | Secret name | Value source |
   | --- | --- |
   | `R2_ACCOUNT_ID` | The same Cloudflare Account ID copied in section 3 |
   | `R2_ACCESS_KEY_ID` | Existing R2 S3 token Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | Existing R2 S3 token Secret Access Key |
   | `ADMIN_BUCKET` | `admin` |

GitHub hides existing secret values. If all four names exist and the leaderboard workflow works, leave them alone.

### Only if the R2 access-key secrets do not exist

1. In Cloudflare, open **R2 Object Storage**.
2. Open **Manage R2 API Tokens**.
3. Select **Create Account API token**.
4. Use token name `Ballsville GitHub stream data`.
5. Select permission **Object Read & Write**.
6. Select **Apply to specific buckets only**.
7. Select only the bucket named `admin`.
8. Leave TTL unset unless you want to rotate the token on a scheduled date.
9. Create the token.
10. Copy both values immediately:
    - **Access Key ID** becomes GitHub secret `R2_ACCESS_KEY_ID`.
    - **Secret Access Key** becomes GitHub secret `R2_SECRET_ACCESS_KEY`.
11. In GitHub **Settings > Secrets and variables > Actions**, use **New repository secret** to add those two secrets plus:
    - `R2_ACCOUNT_ID` = the Account ID from section 3.
    - `ADMIN_BUCKET` = `admin`.

Do not put the R2 Access Key ID or Secret Access Key in Cloudflare Pages variables. Pages accesses R2 through the `ADMIN_BUCKET` binding instead.

## 11. Test the two tools

### Injury Report

1. Sign in at `/stream` with an approved account.
2. Open **Injury Report**.
3. Select its refresh control.
4. It should fetch current Sleeper injury data and save `data/stream/injuries.json` in the existing `admin` bucket.

### Trade Talks

1. Make sure the current leaderboard data has been generated at least once. The trade builder uses that file to discover all Ballsville league IDs and managers.
2. Open **Trade Talks**.
3. Select its refresh control.
4. The page should report that the update was queued.
5. Open GitHub **Actions > Update Stream Data** and confirm a run starts.
6. Wait for the workflow to finish successfully, then reload Trade Talks.

The workflow writes `data/stream/trades.json` in the same `admin` bucket.

## 12. Exact local testing without sending real email

Local development uses a simulated local R2 bucket. It does not modify production R2 data.

1. In the repository root, create a file named `.dev.vars`.
2. Generate a separate local session secret:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

3. Put the following in `.dev.vars`, replacing only the placeholder on the first line:

   ```dotenv
   STREAM_AUTH_SECRET="PASTE_THE_NEW_LOCAL_SECRET_HERE"
   STREAM_APPROVAL_DEV_MODE="true"
   STREAM_PUBLIC_ORIGIN="http://127.0.0.1:8788"
   ```

4. Build the site:

   ```powershell
   npm run build
   ```

5. Start the local Cloudflare Pages runtime:

   ```powershell
   npx wrangler pages dev out --port 8788 --persist-to .wrangler/state
   ```

6. Open `http://127.0.0.1:8788/stream`.
7. Submit a test access request. In local development, the page displays **Open local approval link** instead of sending Gmail.
8. Open that link, approve the test account, and sign in.
9. Stop Wrangler with **Ctrl+C** when finished.

`.dev.vars` is ignored by Git. Never put the production email API token or production session secret in a committed file.

## Troubleshooting by exact error

### “Your request could not be emailed”

Check, in this order:

1. `contact.stickypicky@gmail.com` still says **Verified** under Email Routing destination addresses.
2. Email Routing is enabled for `theballsvillegame.com`.
3. `CLOUDFLARE_ACCOUNT_ID` is the Account ID, not the Zone ID.
4. `STREAM_EMAIL_API_TOKEN` was saved as an encrypted secret and has **Account > Email Sending > Edit**.
5. The token's Account Resource is the account that owns `theballsvillegame.com`.
6. `STREAM_APPROVAL_FROM_EMAIL` is exactly `stream@theballsvillegame.com`.
7. A new Pages deployment was created after saving the variables.

Cloudflare API meanings:

- `401`: token is missing, copied incorrectly, expired, or revoked.
- `403 forbidden`: token lacks **Email Sending > Edit** or is scoped to the wrong account.
- `403 not entitled` or `sending disabled`: Email Routing/sending is not enabled correctly for the account or domain.
- `429`: Cloudflare's send limit was reached.

### “Existing R2 admin bucket binding is unavailable”

The Pages binding is missing or misspelled. It must be `ADMIN_BUCKET` and point to bucket `admin`, followed by a redeployment.

### “Workflow dispatch failed (401 or 403)”

`GH_WORKFLOW_TOKEN` is invalid, expired, scoped to the wrong repository, or does not have **Actions: Read and write**.

### “Workflow dispatch failed (404)”

Check these exact Pages values:

```text
GITHUB_REPO=spickworth1991/ballsville
STREAM_WORKFLOW_FILE=update-stream-data.yml
STREAM_WORKFLOW_REF=main
```

Also confirm the workflow file is present on the `main` branch.

### Account remains unable to sign in

- A pending request cannot sign in.
- Open the emailed review link and press **Approve access**.
- Usernames are case-insensitive.
- Approval links expire after 48 hours and work only once.
- Changing `STREAM_AUTH_SECRET` signs out existing sessions but does not remove approved accounts.

## Data and security reference

- Account record: `data/stream/auth/users/USERNAME.json`
- Injury snapshot: `data/stream/injuries.json`
- Trade snapshot: `data/stream/trades.json`
- Passwords: PBKDF2-SHA-256 hashes only; plaintext passwords are never stored or emailed.
- Approval tokens: random, stored only as hashes, single-use, and expire after 48 hours.
- Public request limit: three account requests per source IP per hour.
- Session cookie: signed, HttpOnly, Secure in production, SameSite Strict, and valid for 12 hours.

## Official references

- [Cloudflare: Email Routing destination addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
- [Cloudflare: Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Cloudflare: Send email through the REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [Cloudflare: Find the Account ID](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)
- [Cloudflare: Create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare: Pages variables, secrets, and R2 bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare: Create R2 access keys](https://developers.cloudflare.com/r2/api/tokens/)
- [GitHub: Workflow dispatch token permission](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
