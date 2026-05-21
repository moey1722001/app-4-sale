import { Client, Databases, ID, Query, Users } from 'node-appwrite';
import crypto from 'node:crypto';

const databaseId = process.env.APPWRITE_DATABASE_ID || 'app4sale';
const invitesCollectionId = process.env.APPWRITE_INVITES_COLLECTION_ID || 'organisationInvites';
const organisationsCollectionId = process.env.APPWRITE_ORGANISATIONS_COLLECTION_ID || 'organisations';

function json(res, data, status = 200) {
  return res.json(data, status);
}

function parseBody(req) {
  if (req.bodyJson) return req.bodyJson;
  if (!req.bodyText && !req.body) return {};
  try {
    return JSON.parse(req.bodyText || req.body);
  } catch {
    return {};
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function inviteUrlFromPayload(payload) {
  if (payload.inviteUrl) return payload.inviteUrl;
  const baseUrl = (process.env.APP_BASE_URL || process.env.VITE_APP_URL || '').replace(/\/$/, '');
  return `${baseUrl}/invite/${encodeURIComponent(payload.token)}`;
}

function personalisedInvite(payload) {
  const inviteUrl = inviteUrlFromPayload(payload);
  const greeting = payload.contactName && payload.contactName !== 'Business owner' ? `Hi ${payload.contactName},` : 'Hi,';
  const body = [
    greeting,
    '',
    `Verola has created a branded business portal for ${payload.businessName}.`,
    '',
    'Use this secure setup link to create your Business Admin account:',
    inviteUrl,
    '',
    'Once setup is complete, you can add customer jobs, track progress, manage staff workflow, and prepare customer updates from your own branded dashboard.',
    '',
    `This invite is for ${payload.adminEmail}.`,
    '',
    'Powered by Verola'
  ].join('\n');

  return {
    subject: payload.subject || `Set up ${payload.businessName} on Verola`,
    text: payload.messageBody || body,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827">
        <h1 style="margin:0 0 12px">Set up ${payload.businessName} on Verola</h1>
        <p>${greeting}</p>
        <p>Verola has created a branded business portal for <strong>${payload.businessName}</strong>.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700">Create your account</a></p>
        <p>After setup, you can add customer jobs, track progress, manage staff workflow, and prepare customer updates from your own branded dashboard.</p>
        <p style="color:#667085;font-size:13px">This invite is for ${payload.adminEmail}. Powered by Verola.</p>
      </div>
    `
  };
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
    expiresAt: payload.expiresAt
  };

  try {
    await databases.updateDocument(databaseId, invitesCollectionId, inviteId, data);
  } catch {
    await databases.createDocument(databaseId, invitesCollectionId, inviteId, data);
  }
}

async function sendEmail(payload, log) {
  const { subject, text, html } = personalisedInvite(payload);

  if (!process.env.RESEND_API_KEY || !process.env.INVITE_EMAIL_FROM) {
    return {
      emailSent: false,
      emailConfigured: false,
      subject,
      text,
      error: 'Email provider is not configured. Add RESEND_API_KEY and INVITE_EMAIL_FROM to this Appwrite Function.'
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.INVITE_EMAIL_FROM,
      to: payload.adminEmail,
      subject,
      text,
      html
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    log(`Resend failed with ${response.status}`);
    return { emailSent: false, emailConfigured: true, subject, text, error: result.message || 'Email provider rejected the invite.' };
  }

  return { emailSent: true, emailConfigured: true, providerMessageId: result.id };
}

async function lookupInvite(databases, token) {
  const hash = tokenHash(token);
  const result = await databases.listDocuments(databaseId, invitesCollectionId, [
    Query.equal('tokenHash', hash)
  ]);
  const invite = result.documents[0];
  if (!invite) return null;
  return {
    id: invite.$id,
    token,
    businessId: invite.organisationId,
    businessName: invite.businessName,
    contactName: invite.contactName,
    adminEmail: invite.adminEmail,
    phone: invite.phone,
    role: invite.role,
    status: invite.status,
    sentAt: 'Email sent',
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt
  };
}

async function acceptInvite(databases, users, payload) {
  const invite = await lookupInvite(databases, payload.token);
  if (!invite) throw new Error('Invite not found.');
  if (invite.status === 'accepted') throw new Error('Invite already accepted.');
  if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error('Invite expired.');

  let user;
  try {
    user = await users.create(ID.unique(), invite.adminEmail, undefined, payload.password, payload.adminName || invite.contactName || invite.adminEmail);
  } catch {
    const existing = await users.list([Query.equal('email', invite.adminEmail)]);
    user = existing.users[0];
    if (!user) throw new Error('Could not create or find invited user.');
  }

  await databases.updateDocument(databaseId, invitesCollectionId, invite.id, {
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    acceptedByUserId: user.$id
  });

  try {
    await databases.updateDocument(databaseId, organisationsCollectionId, invite.businessId, {
      adminEmail: invite.adminEmail,
      contactName: payload.adminName || invite.contactName
    });
  } catch {
    // Organisation updates can be handled by the provisioning flow; invite acceptance should still succeed.
  }

  return { accepted: true, userId: user.$id, businessId: invite.businessId };
}

export default async ({ req, res, log, error }) => {
  try {
    const payload = parseBody(req);
    const action = payload.action;

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key']);

    const databases = new Databases(client);
    const users = new Users(client);

    if (action === 'send_invite_email') {
      if (!payload.token || !payload.businessId || !payload.businessName || !payload.adminEmail) {
        return json(res, { emailSent: false, error: 'Missing invite details.' }, 400);
      }
      await upsertInvite(databases, payload);
      const emailResult = await sendEmail(payload, log);
      return json(res, emailResult, emailResult.emailSent ? 200 : 202);
    }

    if (action === 'lookup_invite') {
      const invite = await lookupInvite(databases, payload.token);
      return json(res, { invite }, invite ? 200 : 404);
    }

    if (action === 'accept_invite') {
      const result = await acceptInvite(databases, users, payload);
      return json(res, result);
    }

    return json(res, { error: 'Unknown action.' }, 400);
  } catch (exception) {
    error(exception?.message || String(exception));
    return json(res, { error: exception?.message || 'Invite function failed.' }, 500);
  }
};
