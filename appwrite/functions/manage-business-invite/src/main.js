import { Account, Client, Databases, ID, Query, Users } from 'node-appwrite';
import crypto from 'node:crypto';

const databaseId = process.env.APPWRITE_DATABASE_ID || 'verola';
const invitesCollectionId = process.env.APPWRITE_INVITES_COLLECTION_ID || 'organisationInvites';
const organisationsCollectionId = process.env.APPWRITE_ORGANISATIONS_COLLECTION_ID || 'organisations';
const logoBucketId = process.env.APPWRITE_LOGO_BUCKET_ID || 'organisation-logos';

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
    endpoint: process.env.APPWRITE_FUNCTION_API_ENDPOINT,
    projectId: process.env.APPWRITE_FUNCTION_PROJECT_ID,
    apiKey,
    databases: new Databases(client),
    users: new Users(client),
    account: new Account(client),
  };
}

function appwriteHeaders(services, contentType = 'application/json') {
  const headers = {
    'X-Appwrite-Project': services.projectId,
    'X-Appwrite-Key': services.apiKey
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function appwriteRequest(services, method, path, body) {
  const response = await fetch(`${services.endpoint}${path}`, {
    method,
    headers: appwriteHeaders(services),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok && response.status !== 409) {
    throw new Error(payload.message || `${method} ${path} failed`);
  }
  return payload;
}

async function ensureLogoBucket(services) {
  await appwriteRequest(services, 'POST', '/storage/buckets', {
    bucketId: logoBucketId,
    name: 'Organisation Logos',
    permissions: [],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 2097152,
    allowedFileExtensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'],
    compression: 'gzip',
    encryption: true,
    antivirus: true
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Invalid logo data.');
  return {
    type: match[1],
    bytes: Buffer.from(match[2], 'base64')
  };
}

async function uploadLogoFile(services, payload) {
  const { type, bytes } = parseDataUrl(payload.logoDataUrl);
  if (!type.startsWith('image/')) throw new Error('Logo must be an image.');
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Logo must be smaller than 2 MB.');
  await ensureLogoBucket(services);

  const form = new FormData();
  const fileId = ID.unique();
  const extension = (payload.logoName || 'logo.png').split('.').pop() || 'png';
  const filename = payload.logoName || `logo.${extension}`;
  form.append('fileId', fileId);
  form.append('file', new Blob([bytes], { type }), filename);
  form.append('permissions[]', 'read("any")');

  const response = await fetch(`${services.endpoint}/storage/buckets/${logoBucketId}/files`, {
    method: 'POST',
    headers: appwriteHeaders(services, null),
    body: form
  });
  const text = await response.text();
  const file = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(file.message || 'Logo upload failed.');
  const logoUrl = `${services.endpoint}/storage/buckets/${logoBucketId}/files/${file.$id}/view?project=${encodeURIComponent(services.projectId)}`;
  return { logoFileId: file.$id, logoUrl, logoName: filename };
}

async function deleteLogoFile(services, fileId) {
  if (!fileId) return;
  try {
    await appwriteRequest(services, 'DELETE', `/storage/buckets/${logoBucketId}/files/${fileId}`);
  } catch {
    // If the file was already removed, still clear the organisation branding.
  }
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
    await users.updatePrefs(user.$id, {
      role: invite.role === 'staff' ? 'staff' : 'admin',
      businessId: invite.businessId,
      name: payload.adminName || invite.contactName,
    });
  } catch { /* best-effort */ }

  try {
    if (invite.role !== 'staff') {
      await databases.updateDocument(databaseId, organisationsCollectionId, invite.businessId, {
        adminEmail: invite.adminEmail,
        contactName: payload.adminName || invite.contactName,
      });
    }
  } catch { /* best-effort */ }

  return { accepted: true, userId: user.$id, businessId: invite.businessId, businessName: invite.businessName, role: invite.role };
}

export default async ({ req, res, log, error }) => {
  try {
    const payload = parseBody(req);
    const action = payload.action;
    const services = createAppwriteServices(req);

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
        // 1. Store invite (best-effort; invite params also embedded in URL as fallback)
        try {
          await upsertInvite(services.databases, payload);
          inviteStored = true;
        } catch (ex) {
          inviteStoreError = ex?.message || 'Could not store invite.';
          log(`Invite storage failed: ${inviteStoreError}`);
        }

        // 2. Find or create user (updates name if unset so template shows correct greeting)
        try {
          const user = await findOrCreateUser(services.users, payload.adminEmail, payload.contactName);
          appwriteUserId = user.$id;
          emailConfigured = true;

          // Prefer the frontend-generated invite URL because it already includes
          // the raw token and business details needed for a no-DB fallback.
          // Appwrite appends userId/secret to this URL automatically.
          const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
          const inviteId = payload.inviteId || '';
          const inviteParams = new URLSearchParams({
            token: payload.token || '',
            businessId: payload.businessId || '',
            business: payload.businessName || '',
            email: payload.adminEmail || '',
            role: payload.role || 'business_admin',
            contact: payload.contactName || '',
            expires: payload.expiresAt || '',
            inviteId,
          });
          if (payload.createdAt) inviteParams.set('created', payload.createdAt);
          if (payload.phone) inviteParams.set('phone', payload.phone);
          const callbackBase = inviteId
            ? `${baseUrl}/accept-invite/${encodeURIComponent(inviteId)}`
            : `${baseUrl}/accept-invite`;
          const generatedCallbackUrl = `${callbackBase}?${inviteParams.toString()}`;
          const callbackUrl = typeof payload.inviteUrl === 'string' && payload.inviteUrl.startsWith('http')
            ? payload.inviteUrl
            : generatedCallbackUrl;

          // Send via Appwrite's built-in email system (template customised in Console)
          await services.account.createMagicURLToken(user.$id, payload.adminEmail, callbackUrl);
          emailSent = true;
          log(`Invite email sent to ${payload.adminEmail} for ${payload.businessName}`);
        } catch (ex) {
          emailError = ex?.message || 'Could not send invite email.';
          log(`Email send failed: ${emailError}`);
        }
      }

      return json(res, { emailSent, emailConfigured, inviteStored, inviteStoreError, appwriteUserId, emailError }, emailSent ? 200 : 202);
    }

    if (action === 'lookup_invite') {
      if (!services.configured) return json(res, { invite: null, error: services.error }, 503);
      const invite = await lookupInviteByToken(services.databases, payload.token);
      return json(res, { invite }, invite ? 200 : 404);
    }

    if (action === 'lookup_invite_by_id') {
      if (!services.configured) return json(res, { invite: null, error: services.error }, 503);
      if (!payload.inviteId) return json(res, { invite: null, error: 'Missing inviteId.' }, 400);
      const invite = await lookupInviteById(services.databases, payload.inviteId);
      return json(res, { invite }, invite ? 200 : 404);
    }

    if (action === 'accept_invite') {
      if (!services.configured) return json(res, { accepted: false, error: services.error }, 503);
      const result = await acceptInvite(services.databases, services.users, payload);
      return json(res, result);
    }

    if (action === 'save_branding') {
      if (!services.configured) return json(res, { saved: false, error: services.error }, 503);
      if (!payload.businessId || !payload.logoDataUrl) {
        return json(res, { saved: false, error: 'Missing businessId or logo data.' }, 400);
      }
      const logo = await uploadLogoFile(services, payload);
      await services.databases.updateDocument(databaseId, organisationsCollectionId, payload.businessId, {
        logoFileId: logo.logoFileId,
        logoUrl: logo.logoUrl,
        logoName: logo.logoName,
      });
      log(`Branding logo saved for ${payload.businessId}`);
      return json(res, { saved: true, ...logo });
    }

    if (action === 'remove_branding') {
      if (!services.configured) return json(res, { removed: false, error: services.error }, 503);
      if (!payload.businessId) {
        return json(res, { removed: false, error: 'Missing businessId.' }, 400);
      }
      await deleteLogoFile(services, payload.logoFileId);
      await services.databases.updateDocument(databaseId, organisationsCollectionId, payload.businessId, {
        logoFileId: '',
        logoUrl: '',
        logoName: '',
      });
      log(`Branding logo removed for ${payload.businessId}`);
      return json(res, { removed: true });
    }

    return json(res, { error: 'Unknown action.' }, 400);
  } catch (ex) {
    error(ex?.message || String(ex));
    return json(res, { error: ex?.message || 'Invite function failed.' }, 500);
  }
};
