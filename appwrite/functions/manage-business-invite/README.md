# Verola Business Invite Function

Use this folder as the Git root directory for the Appwrite Function with ID:

```text
6a0f5ee79aa7bce5c892
```

In Appwrite Console, configure the function deployment source as the existing GitHub repository and set:

- Branch: `main`
- Root directory: `appwrite/functions/manage-business-invite`
- Runtime: Node.js
- Build command: `npm install`
- Entrypoint: `src/main.js`

Do not use the Appwrite template flow that creates/pushes a new repository branch. This repo already has a `main` branch, and that flow can fail with:

```text
Unable to push code repository: fatal: a branch named 'main' already exists
```

Required function variables:

```text
APPWRITE_DATABASE_ID=app4sale
APPWRITE_INVITES_COLLECTION_ID=organisationInvites
APPWRITE_ORGANISATIONS_COLLECTION_ID=organisations
APP_BASE_URL=https://your-verola-domain.com
RESEND_API_KEY=your-resend-api-key
INVITE_EMAIL_FROM=Verola <invites@your-domain.com>
```

If `RESEND_API_KEY` or `INVITE_EMAIL_FROM` is missing, the function returns `emailConfigured: false` and the frontend copies the personalised invite as a fallback.
