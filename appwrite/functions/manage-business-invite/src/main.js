import { Account, Client, Databases, ID, Messaging, Query, Users } from 'node-appwrite';
import crypto from 'node:crypto';

const databaseId = process.env.APPWRITE_DATABASE_ID || 'verola';
const invitesCollectionId = process.env.APPWRITE_INVITES_COLLECTION_ID || 'organisationInvites';
const organisationsCollectionId = process.env.APPWRITE_ORGANISATIONS_COLLECTION_ID || 'organisations';

function json(res, data, status = 200) {
  return res.json(data, status);
}

function parseBody(req) {
  if (req.bodyJson) return req.bodyJson;
  if (!req.bodyText && !req.body) return {};
  try { return JSON.parse(req.bodyText || req.body); } catch { return {}; }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAppwriteServices(req) {
  const apiKey = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'];
  if (!apiKey) return { configured: false, error: 'Missing APPWRITE_API_KEY.' };

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(apiKey);

  return {
    configured: true,
    databases: new Databases(client),
    users: new Users(client),
    account: new Account(client),
    messaging: new Messaging(client),
  };
}

async function findOrCreateUser(users, email, name) {
  try {
    const list = await users.list([Query.equal('email', email)]);
    if (list.users.length > 0) {
      const user = list.users[0];
      if (name && (!user.name || user.name === email.split('@')[0])) {
        try { await users.updateName(user.$id, name); } catch { /* best-effort */ }
      }
      return user;
    }
  } catch { /* search failed, attempt create */ }
  return await users.create(ID.unique(), email, undefined, undefined, name || email.split('@')[0]);
}

async function findOrCreateEmailTarget(users, userId, email) {
  try {
    const list = await users.listTargets(userId);
    const existing = list.targets.find(t => t.identifier === email && t.providerType === 'email');
    if (existing) return existing.$id;
  } catch { /* ignore */ }
  const target = await users.createTarget(userId, ID.unique(), 'email', email);
  return target.$id;
}

function buildInviteEmailHtml(payload, acceptUrl) {
  const business = payload.businessName || 'your business';
  const contact = payload.contactName || payload.adminEmail.split('@')[0];
  const role = (payload.role || 'business_admin').replace(/_/g, ' ');
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const expiryLabel = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '14 days';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You're invited to ${business} on Verola</title>
</head>
<body style="margin:0;padding:24px;background:#f0f0f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
    <tr><td>
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
        <tr>
          <td style="padding:0 4px">
            <span style="font-size:26px;font-weight:800;color:#3b2f8f;letter-spacing:-0.5px">Verola</span>
            <span style="font-size:11px;color:#9b96c4;margin-left:8px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px">Business Platform</span>
          </td>
        </tr>
      </table>

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(59,47,143,0.10);overflow:hidden">
        <!-- Purple top bar -->
        <tr><td style="background:linear-gradient(135deg,#3b2f8f,#5b4fcf);padding:28px 32px">
          <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px">Business Invitation</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3">You're invited to<br>${business}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.6">
            Hi <strong>${contact}</strong>,
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7">
            You've been invited to manage <strong style="color:#3b2f8f">${business}</strong> on Verola.
            Click the button below to set up your account and get started.
          </p>

          <!-- Details card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6ff;border-radius:10px;margin-bottom:28px">
            <tr><td style="padding:20px 24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#888;padding:5px 0">Business</td>
                  <td style="font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;padding:5px 0">${business}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#888;padding:5px 0;border-top:1px solid #ede9ff">Your role</td>
                  <td style="font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;padding:5px 0;border-top:1px solid #ede9ff">${roleLabel}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#888;padding:5px 0;border-top:1px solid #ede9ff">Invite expires</td>
                  <td style="font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;padding:5px 0;border-top:1px solid #ede9ff">${expiryLabel}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${acceptUrl}" style="display:inline-block;background:#3b2f8f;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.2px">
                Accept invite &amp; set up account
              </a>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#aaa;text-align:center">
            This link expires on ${expiryLabel}. If you didn't expect this invite, you can safely ignore this email.
          </p>
          <p style="margin:12px 0 0;font-size:12px;color:#ccc;text-align:center;word-break:break-all">
            ${acceptUrl}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#bbb">
            Powered by <strong style="color:#3b2f8f">Verola</strong> &bull; Run your business. Grow every day.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function upsertInvite(databases, payload) {
  const now = new Date().toISOString();
  const inviteId = payload.inviteId || ID.unique();
  const data = {
    organisationId: payload.businessId,
    businessName: payload.businessName,
    contactName: payload.contactName || 'Business owner',
    adminEmail: payload.adminEmail,
    phone: payload.phone || '',
    tokenHash: tokenHash(payload.token),
    role: payload.role || 'business_admin',
    status: 'pending',
    createdAt: payload.createdAt || now,
    expiresAt: payload.expiresAt,
  };
  try {
    await databases.updateDocument(databaseId, invitesCollectionId, inviteId, data);
  } catch {
    await databases.createDocument(databaseId, invitesCollectionId, inviteId, data);
  }
}

async function lookupInviteByToken(databases, token) {
  const hash = tokenHash(token);
  const result = await databases.listDocuments(databaseId, invitesCollectionId, [Query.equal('tokenHash', hash)]);
  const doc = result.documents[0];
  if (!doc) return null;
  return normalizeInviteDoc(doc, token);
}

async function lookupInviteById(databases, inviteId) {
  try {
    const doc = await databases.getDocument(databaseId, invitesCollectionId, inviteId);
    return normalizeInviteDoc(doc, null);
  } catch { return null; }
}

function normalizeInviteDoc(doc, rawToken) {
  return {
    id: doc.$id,
    token: rawToken || null,
    businessId: doc.organisationId,
    businessName: doc.businessName,
    contactName: doc.contactName,
    adminEmail: doc.adminEmail,
    phone: doc.phone,
    role: doc.role,
    status: doc.status,
    sentAt: doc.sentAt || null,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    acceptedAt: doc.acceptedAt || null,
  };
}

async function acceptInvite(databases, users, payload) {
  let invite;
  if (payload.inviteId) {
    invite = await lookupInviteById(databases, payload.inviteId);
  } else {
    invite = await lookupInviteByToken(databases, payload.token);
  }
  if (!invite) throw new Error('Invite not found.');
  if (invite.status === 'accepted') throw new Error('Invite already accepted.');
  if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error('Invite has expired.');

  let user;
  try {
    user = await users.create(ID.unique(), invite.adminEmail, undefined, payload.password, payload.adminName || invite.contactName || invite.adminEmail);
  } catch {
    const existing = await users.list([Query.equal('email', invite.adminEmail)]);
    user = existing.users[0];
    if (payload.password) {
      try { await users.updatePassword(user.$id, payload.password); } catch { /* ignore if set via magic URL */ }
    }
    if (!user) throw new Error('Could not create or find invited user.');
  }

  await databases.updateDocument(databaseId, invitesCollectionId, invite.id, {
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    acceptedByUserId: user.$id,
  });

  try {
    await databases.updateDocument(databaseId, organisationsCollectionId, invite.businessId, {
      adminEmail: invite.adminEmail,
      contactName: payload.adminName || invite.contactName,
    });
  } catch { /* organisation update is best-effort */ }

  return { accepted: true, userId: user.$id, businessId: invite.businessId, businessName: invite.businessName, role: invite.role };
}

export default async ({ req, res, log, error }) => {
  try {
    const payload = parseBody(req);
    const action = payload.action;
    const services = createAppwriteServices(req);

    // --- send_invite: store invite + send personalised Verola email ---
    if (action === 'send_invite' || action === 'send_invite_email') {
      if (!payload.token || !payload.businessId || !payload.businessName || !payload.adminEmail) {
        return json(res, { emailSent: false, error: 'Missing invite fields.' }, 400);
      }

      let inviteStored = false;
      let inviteStoreError = '';
      let emailSent = false;
      let emailConfigured = false;
      let emailError = '';
      let appwriteUserId = null;

      if (!services.configured) {
        inviteStoreError = services.error;
        log(inviteStoreError);
      } else {
        // 1. Store invite in DB (best-effort; invite params are also embedded in URL as fallback)
        try {
          await upsertInvite(services.databases, payload);
          inviteStored = true;
        } catch (ex) {
          inviteStoreError = ex?.message || 'Could not store invite.';
          log(`Invite storage failed: ${inviteStoreError}`);
        }

        // 2. Find or create user (with name update)
        try {
          const user = await findOrCreateUser(services.users, payload.adminEmail, payload.contactName);
          appwriteUserId = user.$id;
          emailConfigured = true;

          // 3. Build callback URL with all invite details embedded as query params.
          //    Appwrite will append &userId=&secret= when it processes the magic link.
          const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
          const inviteId = payload.inviteId || '';
          const inviteParams = new URLSearchParams({
            businessId: payload.businessId || '',
            business: payload.businessName || '',
            email: payload.adminEmail || '',
            role: payload.role || 'business_admin',
            contact: payload.contactName || '',
            expires: payload.expiresAt || '',
            inviteId,
          });
          if (payload.phone) inviteParams.set('phone', payload.phone);
          const callbackBase = inviteId
            ? `${baseUrl}/accept-invite/${encodeURIComponent(inviteId)}`
            : `${baseUrl}/accept-invite`;

          // 4a. Try to send a fully personalised Verola-branded email via Appwrite Messaging.
          //     Uses users.createToken() so we control the email content, not Appwrite's template.
          let messagingSent = false;
          try {
            // Create a token (does NOT send any email — we send our own below)
            const tokenExpiry = Math.floor(Date.now() / 1000) + 86400; // 24h
            const userToken = await services.users.createToken(user.$id, undefined, tokenExpiry);

            // Build the full magic URL (Appwrite won't auto-append params here since we skip createMagicURLToken)
            const acceptUrl = `${callbackBase}?${inviteParams.toString()}&userId=${encodeURIComponent(userToken.userId)}&secret=${encodeURIComponent(userToken.secret)}`;

            // Create / find email messaging target for this user
            const targetId = await findOrCreateEmailTarget(services.users, user.$id, payload.adminEmail);

            // Send fully custom HTML email
            const htmlBody = buildInviteEmailHtml(payload, acceptUrl);
            await services.messaging.createEmail(
              ID.unique(),
              `You're invited to ${payload.businessName} on Verola`,
              htmlBody,
              [], [], [targetId], [], [], [], false, true
            );
            messagingSent = true;
            emailSent = true;
            log(`Custom Verola invite email sent to ${payload.adminEmail} via Messaging`);
          } catch (msgEx) {
            log(`Messaging failed (${msgEx?.message}), falling back to Appwrite magic URL email`);
          }

          // 4b. Fallback: use Appwrite's built-in magic URL email (less personalised but reliable)
          if (!messagingSent) {
            const callbackUrl = `${callbackBase}?${inviteParams.toString()}`;
            await services.account.createMagicURLToken(user.$id, payload.adminEmail, callbackUrl);
            emailSent = true;
            log(`Fallback magic URL email sent to ${payload.adminEmail}`);
          }
        } catch (ex) {
          emailError = ex?.message || 'Could not send invite email.';
          log(`Email send failed: ${emailError}`);
        }
      }

      return json(res, { emailSent, emailConfigured, inviteStored, inviteStoreError, appwriteUserId, emailError }, emailSent ? 200 : 202);
    }

    // --- lookup_invite: by token hash ---
    if (action === 'lookup_invite') {
      if (!services.configured) return json(res, { invite: null, error: services.error }, 503);
      const invite = await lookupInviteByToken(services.databases, payload.token);
      return json(res, { invite }, invite ? 200 : 404);
    }

    // --- lookup_invite_by_id: by document ID (used after clicking magic URL email) ---
    if (action === 'lookup_invite_by_id') {
      if (!services.configured) return json(res, { invite: null, error: services.error }, 503);
      if (!payload.inviteId) return json(res, { invite: null, error: 'Missing inviteId.' }, 400);
      const invite = await lookupInviteById(services.databases, payload.inviteId);
      return json(res, { invite }, invite ? 200 : 404);
    }

    // --- accept_invite: validate + create account + assign tenant ---
    if (action === 'accept_invite') {
      if (!services.configured) return json(res, { accepted: false, error: services.error }, 503);
      const result = await acceptInvite(services.databases, services.users, payload);
      return json(res, result);
    }

    return json(res, { error: 'Unknown action.' }, 400);
  } catch (ex) {
    error(ex?.message || String(ex));
    return json(res, { error: ex?.message || 'Invite function failed.' }, 500);
  }
};
