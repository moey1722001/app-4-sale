const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'verola';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Key': apiKey
};

async function request(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const duplicate = response.status === 409;
    if (duplicate) return { duplicate: true, payload };
    throw new Error(`${method} ${path} failed: ${response.status} ${payload.message || text}`);
  }

  return { duplicate: false, payload };
}

async function ensureDatabase() {
  const result = await request('POST', '/databases', {
    databaseId,
    name: 'Verola'
  });

  console.log(result.duplicate ? `Database exists: ${databaseId}` : `Database created: ${databaseId}`);
}

async function ensureCollection(collection) {
  const result = await request('POST', `/databases/${databaseId}/collections`, {
    collectionId: collection.id,
    name: collection.name,
    permissions: collection.permissions || [],
    documentSecurity: true,
    enabled: true
  });

  console.log(result.duplicate ? `Collection exists: ${collection.id}` : `Collection created: ${collection.id}`);
}

async function ensureAttribute(collectionId, attribute) {
  const body = { key: attribute.key, required: Boolean(attribute.required), array: false };
  let path = `/databases/${databaseId}/collections/${collectionId}/attributes`;

  if (attribute.default !== undefined && !attribute.required) {
    body.default = attribute.default;
  }

  if (attribute.type === 'string') {
    path += '/string';
    body.size = attribute.size || 255;
  } else if (attribute.type === 'boolean') {
    path += '/boolean';
  } else if (attribute.type === 'datetime') {
    path += '/datetime';
  } else if (attribute.type === 'enum') {
    path += '/enum';
    body.elements = attribute.elements;
  } else if (attribute.type === 'integer') {
    path += '/integer';
  } else {
    throw new Error(`Unknown attribute type: ${attribute.type}`);
  }

  const result = await request('POST', path, body);
  console.log(result.duplicate ? `  Attribute exists: ${collectionId}.${attribute.key}` : `  Attribute created: ${collectionId}.${attribute.key}`);
}

async function ensureIndex(collectionId, index) {
  const result = await request('POST', `/databases/${databaseId}/collections/${collectionId}/indexes`, {
    key: index.key,
    type: index.type,
    attributes: index.attributes,
    orders: index.orders || []
  });

  console.log(result.duplicate ? `  Index exists: ${collectionId}.${index.key}` : `  Index created: ${collectionId}.${index.key}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const statuses = ['collected', 'in_progress', 'ready_for_pickup', 'completed'];
const jobPriorities = ['standard', 'urgent', 'hold'];
const smsProviders = ['clicksend', 'telnyx'];
const smsSetupStatuses = ['not_configured', 'connected', 'failed'];
const smsLogStatuses = ['pending', 'sent', 'delivered', 'failed'];
const rosterStatuses = ['draft', 'sent', 'accepted', 'declined'];
const inviteStatuses = ['pending', 'accepted', 'expired'];

const collections = [
  {
    id: 'organisations',
    name: 'Organisations',
    attributes: [
      { key: 'name', type: 'string', size: 160, required: true },
      { key: 'industry', type: 'string', size: 80, required: true },
      { key: 'location', type: 'string', size: 120 },
      { key: 'isEnabled', type: 'boolean', default: true },
      { key: 'plan', type: 'enum', elements: ['starter', 'growth', 'scale'], default: 'starter' },
      { key: 'subscriptionStatus', type: 'enum', elements: ['trialing', 'active', 'past_due', 'cancelled'], default: 'trialing' },
      { key: 'logoFileId', type: 'string', size: 255 },
      { key: 'primaryColour', type: 'string', size: 24, default: '#0f766e' },
      { key: 'accentColour', type: 'string', size: 24, default: '#f59e0b' },
      { key: 'messagingEnabled', type: 'boolean', default: false },
      { key: 'smsProvider', type: 'enum', elements: smsProviders },
      { key: 'smsSenderName', type: 'string', size: 40, default: 'VEROLA' },
      { key: 'smsSetupStatus', type: 'enum', elements: smsSetupStatuses, default: 'not_configured' },
      { key: 'teamId', type: 'string', size: 80, required: true }
    ],
    indexes: [
      { key: 'by_team', type: 'key', attributes: ['teamId'] },
      { key: 'by_enabled', type: 'key', attributes: ['isEnabled'] },
      { key: 'search_name', type: 'fulltext', attributes: ['name'] }
    ]
  },
  {
    id: 'organisationInvites',
    name: 'Organisation Invites',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'businessName', type: 'string', size: 160, required: true },
      { key: 'contactName', type: 'string', size: 160 },
      { key: 'adminEmail', type: 'string', size: 160, required: true },
      { key: 'phone', type: 'string', size: 40 },
      { key: 'tokenHash', type: 'string', size: 160, required: true },
      { key: 'role', type: 'enum', elements: ['business_admin', 'staff'], default: 'business_admin' },
      { key: 'status', type: 'enum', elements: inviteStatuses, default: 'pending' },
      { key: 'invitedByUserId', type: 'string', size: 80 },
      { key: 'acceptedByUserId', type: 'string', size: 80 },
      { key: 'acceptedAt', type: 'datetime' },
      { key: 'createdAt', type: 'datetime' },
      { key: 'expiresAt', type: 'datetime' }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_email', type: 'key', attributes: ['adminEmail'] },
      { key: 'by_status', type: 'key', attributes: ['status'] },
      { key: 'by_token_hash', type: 'unique', attributes: ['tokenHash'] }
    ]
  },
  {
    id: 'customers',
    name: 'Customers',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'fullName', type: 'string', size: 160, required: true },
      { key: 'phone', type: 'string', size: 40, required: true },
      { key: 'email', type: 'string', size: 160 },
      { key: 'notes', type: 'string', size: 2000 }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_phone', type: 'key', attributes: ['phone'] },
      { key: 'search_name', type: 'fulltext', attributes: ['fullName'] }
    ]
  },
  {
    id: 'jobs',
    name: 'Jobs',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'customerId', type: 'string', size: 80, required: true },
      { key: 'jobNumber', type: 'string', size: 40, required: true },
      { key: 'itemSummary', type: 'string', size: 255, required: true },
      { key: 'serviceType', type: 'string', size: 120 },
      { key: 'priority', type: 'enum', elements: jobPriorities, default: 'standard' },
      { key: 'estimate', type: 'string', size: 80 },
      { key: 'notes', type: 'string', size: 2000 },
      { key: 'status', type: 'enum', elements: statuses, default: 'collected' },
      { key: 'paymentStatus', type: 'enum', elements: ['unpaid', 'paid'], default: 'unpaid' },
      { key: 'paidAt', type: 'datetime' },
      { key: 'promisedAt', type: 'datetime' },
      { key: 'completedAt', type: 'datetime' },
      { key: 'createdBy', type: 'string', size: 80 }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_status', type: 'key', attributes: ['status'] },
      { key: 'by_priority', type: 'key', attributes: ['priority'] },
      { key: 'by_payment_status', type: 'key', attributes: ['paymentStatus'] },
      { key: 'by_customer', type: 'key', attributes: ['customerId'] },
      { key: 'by_job_number', type: 'key', attributes: ['jobNumber'] }
    ]
  },
  {
    id: 'jobStatusEvents',
    name: 'Job Status Events',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'jobId', type: 'string', size: 80, required: true },
      { key: 'status', type: 'enum', elements: statuses, required: true },
      { key: 'changedBy', type: 'string', size: 80 }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_job', type: 'key', attributes: ['jobId'] }
    ]
  },
  {
    id: 'smsTemplates',
    name: 'SMS Templates',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'status', type: 'enum', elements: statuses, required: true },
      { key: 'body', type: 'string', size: 1200, required: true },
      { key: 'isEnabled', type: 'boolean', default: true }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_status', type: 'key', attributes: ['status'] }
    ]
  },
  {
    id: 'workflowStages',
    name: 'Workflow Stages',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'statusKey', type: 'enum', elements: statuses, required: true },
      { key: 'label', type: 'string', size: 80, required: true },
      { key: 'buttonLabel', type: 'string', size: 80, required: true },
      { key: 'nextStep', type: 'string', size: 160, required: true },
      { key: 'tone', type: 'string', size: 40 }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_status_key', type: 'key', attributes: ['statusKey'] }
    ]
  },
  {
    id: 'smsProviderCredentials',
    name: 'SMS Provider Credentials',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'provider', type: 'enum', elements: smsProviders, required: true },
      { key: 'encryptedCredentials', type: 'string', size: 4000, required: true },
      { key: 'maskedKeyPreview', type: 'string', size: 80 },
      { key: 'connectionStatus', type: 'enum', elements: smsSetupStatuses, default: 'not_configured' },
      { key: 'lastTestedAt', type: 'datetime' },
      { key: 'createdAt', type: 'datetime' },
      { key: 'updatedAt', type: 'datetime' }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_provider', type: 'key', attributes: ['provider'] },
      { key: 'by_connection_status', type: 'key', attributes: ['connectionStatus'] }
    ]
  },
  {
    id: 'smsLogs',
    name: 'SMS Logs',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'customerId', type: 'string', size: 80, required: true },
      { key: 'jobId', type: 'string', size: 80, required: true },
      { key: 'provider', type: 'enum', elements: smsProviders, required: true },
      { key: 'phoneNumber', type: 'string', size: 40, required: true },
      { key: 'messageBody', type: 'string', size: 1200, required: true },
      { key: 'templateKey', type: 'string', size: 80 },
      { key: 'status', type: 'enum', elements: smsLogStatuses, default: 'pending' },
      { key: 'providerMessageId', type: 'string', size: 255 },
      { key: 'errorMessage', type: 'string', size: 2000 },
      { key: 'sentByUserId', type: 'string', size: 80 },
      { key: 'createdAt', type: 'datetime' }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_job', type: 'key', attributes: ['jobId'] },
      { key: 'by_customer', type: 'key', attributes: ['customerId'] },
      { key: 'by_status', type: 'key', attributes: ['status'] },
      { key: 'by_provider', type: 'key', attributes: ['provider'] }
    ]
  },
  {
    id: 'staffShifts',
    name: 'Staff Shifts',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'staffUserId', type: 'string', size: 80, required: true },
      { key: 'staffName', type: 'string', size: 160, required: true },
      { key: 'clockInAt', type: 'datetime', required: true },
      { key: 'clockOutAt', type: 'datetime' },
      { key: 'status', type: 'enum', elements: ['clocked_in', 'clocked_out'], default: 'clocked_in' },
      { key: 'totalMinutes', type: 'integer' }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_staff', type: 'key', attributes: ['staffUserId'] },
      { key: 'by_status', type: 'key', attributes: ['status'] }
    ]
  },
  {
    id: 'rosterShifts',
    name: 'Roster Shifts',
    attributes: [
      { key: 'organisationId', type: 'string', size: 80, required: true },
      { key: 'staffUserId', type: 'string', size: 80, required: true },
      { key: 'staffName', type: 'string', size: 160, required: true },
      { key: 'role', type: 'string', size: 80 },
      { key: 'shiftDate', type: 'string', size: 40, required: true },
      { key: 'startTime', type: 'string', size: 40, required: true },
      { key: 'endTime', type: 'string', size: 40, required: true },
      { key: 'area', type: 'string', size: 120 },
      { key: 'responseStatus', type: 'enum', elements: rosterStatuses, default: 'draft' },
      { key: 'respondedAt', type: 'datetime' },
      { key: 'createdBy', type: 'string', size: 80 }
    ],
    indexes: [
      { key: 'by_org', type: 'key', attributes: ['organisationId'] },
      { key: 'by_staff', type: 'key', attributes: ['staffUserId'] },
      { key: 'by_shift_date', type: 'key', attributes: ['shiftDate'] },
      { key: 'by_response_status', type: 'key', attributes: ['responseStatus'] }
    ]
  }
];

await ensureDatabase();

for (const collection of collections) {
  await ensureCollection(collection);

  for (const attribute of collection.attributes) {
    await ensureAttribute(collection.id, attribute);
  }
}

console.log('Waiting for attributes to become available before creating indexes...');
await sleep(15000);

for (const collection of collections) {
  for (const index of collection.indexes) {
    await ensureIndex(collection.id, index);
  }
}

console.log('Appwrite provisioning complete.');
