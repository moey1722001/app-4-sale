import { useEffect, useMemo, useState } from 'react';
import { ExecutionMethod } from 'appwrite';
import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  History,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MessageSquareText,
  Paintbrush,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  UserPlus,
  Users,
  X,
  Wrench
} from 'lucide-react';
import { ID } from 'appwrite';
import {
  appBaseUrl,
  appwriteDatabaseId,
  appwriteInviteFunctionId,
  appwriteLogoBucketId,
  appwriteOrganisationCollectionId,
  account,
  databases,
  functions,
  hasAppwriteConfig,
  storage
} from './lib/appwrite';
import { BrandProvider, OrganisationBrand, platformBrand, useBranding } from './lib/branding';

type Portal = 'super' | 'admin' | 'staff';
type UserRole = Portal;
type JobStatus = 'collected' | 'in_progress' | 'ready_for_pickup' | 'completed';
type SmsProvider = 'clicksend' | 'telnyx';
type SmsSetupStatus = 'not_configured' | 'connected' | 'failed';
type ShiftResponse = 'draft' | 'sent' | 'accepted' | 'declined';
type InviteStatus = 'pending' | 'accepted' | 'expired';

type Business = {
  id: string;
  name: string;
  industry: string;
  location: string;
  plan: 'Starter' | 'Growth' | 'Scale';
  active: boolean;
  staff: number;
  sms: number;
  jobs: number;
  primary: string;
  accent: string;
  sender: string;
  logoName?: string;
  logoUrl?: string;
  logoFileId?: string;
  appIconUrl?: string;
  faviconUrl?: string;
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  emailHeaderLogoUrl?: string;
  messagingEnabled: boolean;
  smsProvider: SmsProvider | null;
  smsSenderName: string;
  smsSetupStatus: SmsSetupStatus;
  maskedKeyPreview?: string;
  adminEmail?: string;
  contactName?: string;
  contactPhone?: string;
};

type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
  businessId?: string;
};

type OrganisationInvite = {
  id: string;
  token: string;
  businessId: string;
  businessName: string;
  contactName: string;
  adminEmail: string;
  phone: string;
  role: 'business_admin';
  status: InviteStatus;
  sentAt: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
};

type SetupDraft = {
  name: string;
  password: string;
  error: string;
};

type WorkflowStage = {
  label: string;
  verb: string;
  nextStep: string;
  tone: string;
};

type Job = {
  id: string;
  customer: string;
  phone: string;
  item: string;
  serviceType: string;
  priority: 'Standard' | 'Urgent' | 'Hold';
  estimate: string;
  notes: string;
  status: JobStatus;
  paid: boolean;
  paidAt?: string;
  due: string;
  businessId: string;
  updates: Array<{ status?: JobStatus; at: string; sms: string; kind?: 'status' | 'note' | 'payment' }>;
};

type SmsPreview = {
  jobId: string;
  customer: string;
  phone: string;
  status: JobStatus;
  message: string;
};

type StaffMember = {
  name: string;
  role: 'Owner' | 'Manager' | 'Staff';
  phone: string;
  active: boolean;
  clockedIn: boolean;
  clockInAt?: string;
  hoursToday: number;
  lastShift: string;
};

type RosterShift = {
  id: string;
  businessId: string;
  staffName: string;
  role: string;
  date: string;
  start: string;
  end: string;
  area: string;
  response: ShiftResponse;
};

const initialBusinesses: Business[] = [
  {
    id: 'fresh-fold',
    name: 'Fresh Fold Laundry',
    industry: 'Laundromat',
    location: 'Parramatta',
    plan: 'Growth',
    active: true,
    staff: 8,
    sms: 1242,
    jobs: 47,
    primary: '#4f46e5',
    accent: '#06b6d4',
    sender: 'FRESHFOLD',
    adminEmail: 'owner@freshfold.test',
    messagingEnabled: false,
    smsProvider: null,
    smsSenderName: 'FRESHFOLD',
    smsSetupStatus: 'not_configured'
  },
  {
    id: 'rapid-auto',
    name: 'Rapid Auto Care',
    industry: 'Mechanic',
    location: 'Blacktown',
    plan: 'Scale',
    active: true,
    staff: 14,
    sms: 2180,
    jobs: 33,
    primary: '#1d4ed8',
    accent: '#ef4444',
    sender: 'RAPIDAUTO',
    adminEmail: 'admin@rapidauto.test',
    messagingEnabled: true,
    smsProvider: 'telnyx',
    smsSenderName: 'RAPIDAUTO',
    smsSetupStatus: 'connected',
    maskedKeyPreview: '...8K2Q'
  },
  {
    id: 'stitch-studio',
    name: 'Stitch Studio',
    industry: 'Tailoring',
    location: 'Newtown',
    plan: 'Starter',
    active: false,
    staff: 3,
    sms: 318,
    jobs: 12,
    primary: '#7c3aed',
    accent: '#14b8a6',
    sender: 'STITCH',
    adminEmail: 'hello@stitchstudio.test',
    messagingEnabled: false,
    smsProvider: null,
    smsSenderName: 'STITCH',
    smsSetupStatus: 'not_configured'
  },
  {
    id: 'paws-and-polish',
    name: 'Paws & Polish Grooming',
    industry: 'Pet groomer',
    location: 'Marrickville',
    plan: 'Growth',
    active: true,
    staff: 6,
    sms: 864,
    jobs: 28,
    primary: '#0f766e',
    accent: '#f59e0b',
    sender: 'PAWSPOLISH',
    adminEmail: 'owner@pawspolish.test',
    messagingEnabled: true,
    smsProvider: 'clicksend',
    smsSenderName: 'PAWSPOLISH',
    smsSetupStatus: 'connected',
    maskedKeyPreview: '...P4WS'
  },
  {
    id: 'glow-lane',
    name: 'Glow Lane Beauty',
    industry: 'Beauty clinic',
    location: 'Surry Hills',
    plan: 'Starter',
    active: true,
    staff: 4,
    sms: 512,
    jobs: 19,
    primary: '#be123c',
    accent: '#f97316',
    sender: 'GLOWLANE',
    adminEmail: 'hello@glowlane.test',
    messagingEnabled: false,
    smsProvider: null,
    smsSenderName: 'GLOWLANE',
    smsSetupStatus: 'not_configured'
  }
];

const staff: StaffMember[] = [
  { name: 'Ava Chen', role: 'Owner', phone: '+61 412 200 100', active: true, clockedIn: true, clockInAt: '7:58 AM', hoursToday: 6.2, lastShift: 'Yesterday 8.1h' },
  { name: 'Noah Singh', role: 'Manager', phone: '+61 419 510 340', active: true, clockedIn: true, clockInAt: '8:16 AM', hoursToday: 5.7, lastShift: 'Yesterday 7.8h' },
  { name: 'Mia Taylor', role: 'Staff', phone: '+61 421 887 220', active: true, clockedIn: false, hoursToday: 0, lastShift: 'Mon 5.5h' },
  { name: 'Leo Park', role: 'Staff', phone: '+61 438 881 901', active: false, clockedIn: false, hoursToday: 0, lastShift: 'Fri 4.0h' }
];

const seedRosterShifts: RosterShift[] = [
  {
    id: 'RS-201',
    businessId: 'fresh-fold',
    staffName: 'Mia Taylor',
    role: 'Front counter',
    date: '2026-05-26',
    start: '8:00 AM',
    end: '2:00 PM',
    area: 'Drop-off desk',
    response: 'sent'
  },
  {
    id: 'RS-202',
    businessId: 'fresh-fold',
    staffName: 'Noah Singh',
    role: 'Manager',
    date: '2026-05-26',
    start: '10:00 AM',
    end: '6:00 PM',
    area: 'Operations',
    response: 'accepted'
  },
  {
    id: 'RS-203',
    businessId: 'fresh-fold',
    staffName: 'Mia Taylor',
    role: 'Pickup counter',
    date: '2026-05-28',
    start: '12:00 PM',
    end: '6:00 PM',
    area: 'Customer pickup',
    response: 'accepted'
  },
  {
    id: 'RS-204',
    businessId: 'fresh-fold',
    staffName: 'Leo Park',
    role: 'Floor support',
    date: '2026-05-29',
    start: '9:00 AM',
    end: '1:00 PM',
    area: 'Sorting',
    response: 'declined'
  }
];

const seedJobs: Job[] = [
  {
    id: 'J-1048',
    customer: 'Sarah McKenzie',
    phone: '+61 412 444 212',
    item: '2 bags wash and fold',
    serviceType: 'Wash and fold',
    priority: 'Standard',
    estimate: '$34',
    notes: 'Use sensitive detergent',
    status: 'collected',
    paid: false,
    due: 'Today 4:30 PM',
    businessId: 'fresh-fold',
    updates: [{ status: 'collected', at: '9:08 AM', sms: 'We have received your order.' }]
  },
  {
    id: 'J-1049',
    customer: 'Mohammed Ali',
    phone: '+61 421 980 110',
    item: 'Suit dry clean',
    serviceType: 'Dry cleaning',
    priority: 'Urgent',
    estimate: '$48',
    notes: 'Pickup before work tomorrow',
    status: 'in_progress',
    paid: true,
    paidAt: '8:45 AM',
    due: 'Tomorrow 8:00 AM',
    businessId: 'fresh-fold',
    updates: [
      { status: 'collected', at: '8:42 AM', sms: 'We have received your order.' },
      { status: 'in_progress', at: '10:15 AM', sms: 'Your order is now in progress.' }
    ]
  },
  {
    id: 'J-1050',
    customer: 'Olivia Brown',
    phone: '+61 409 887 331',
    item: 'King quilt',
    serviceType: 'Bulky item',
    priority: 'Standard',
    estimate: '$55',
    notes: 'Call on arrival',
    status: 'ready_for_pickup',
    paid: false,
    due: 'Today 2:00 PM',
    businessId: 'fresh-fold',
    updates: [
      { status: 'collected', at: 'Yesterday', sms: 'We have received your order.' },
      { status: 'ready_for_pickup', at: '11:35 AM', sms: 'Your order is ready for pickup.' }
    ]
  },
  {
    id: 'J-2051',
    customer: 'Daniel Harper',
    phone: '+61 430 118 442',
    item: 'Toyota Corolla inspection',
    serviceType: 'Vehicle inspection',
    priority: 'Standard',
    estimate: '$189',
    notes: 'Customer asked for tyre and brake photos before approval.',
    status: 'in_progress',
    paid: false,
    due: 'Today 5:00 PM',
    businessId: 'rapid-auto',
    updates: [
      { status: 'collected', at: '8:10 AM', sms: 'Vehicle checked in.' },
      { status: 'in_progress', at: '11:20 AM', sms: 'Inspection has started. We will send findings shortly.' }
    ]
  },
  {
    id: 'J-3052',
    customer: 'Priya Nair',
    phone: '+61 411 330 889',
    item: 'Milo full groom',
    serviceType: 'Pet grooming',
    priority: 'Standard',
    estimate: '$72',
    notes: 'Milo is nervous around dryers. Use low speed.',
    status: 'ready_for_pickup',
    paid: true,
    paidAt: '1:15 PM',
    due: 'Today 3:30 PM',
    businessId: 'paws-and-polish',
    updates: [
      { status: 'collected', at: '10:05 AM', sms: 'Milo has arrived safely.' },
      { status: 'ready_for_pickup', at: '2:40 PM', sms: 'Milo is ready for pickup and looking fresh.' }
    ]
  },
  {
    id: 'J-4053',
    customer: 'Emma Wilson',
    phone: '+61 422 902 144',
    item: 'Skin consultation reminder',
    serviceType: 'Appointment reminder',
    priority: 'Standard',
    estimate: '$0',
    notes: 'Send reminder before appointment. Customer prefers SMS.',
    status: 'completed',
    paid: true,
    paidAt: 'Yesterday',
    due: 'Tomorrow 10:00 AM',
    businessId: 'glow-lane',
    updates: [
      { status: 'completed', at: 'Yesterday', sms: 'Appointment reminder sent for tomorrow at 10:00 AM.' }
    ]
  }
];

const statusFlow: JobStatus[] = ['collected', 'in_progress', 'ready_for_pickup', 'completed'];

const defaultWorkflowStages: Record<JobStatus, WorkflowStage> = {
  collected: {
    label: 'Collected',
    verb: 'Mark collected',
    nextStep: 'Start the work',
    tone: 'blue'
  },
  in_progress: {
    label: 'In progress',
    verb: 'Start work',
    nextStep: 'Finish and mark ready',
    tone: 'amber'
  },
  ready_for_pickup: {
    label: 'Ready for pickup',
    verb: 'Ready',
    nextStep: 'Notify and hand over',
    tone: 'green'
  },
  completed: {
    label: 'Completed',
    verb: 'Complete',
    nextStep: 'Archived',
    tone: 'slate'
  }
};

const portalMeta = {
  super: { label: 'Super Admin', icon: ShieldCheck },
  admin: { label: 'Business Admin', icon: Building2 },
  staff: { label: 'Staff', icon: Shirt }
} satisfies Record<Portal, { label: string; icon: typeof ShieldCheck }>;

const portalPaths: Record<Portal, string> = {
  super: '/super-admin',
  admin: '/business-admin',
  staff: '/staff'
};

const inviteStorageKey = 'verola.organisationInvites.v2';
const businessStorageKey = 'verola.businesses.v2';
const userStorageKey = 'verola.createdUsers.v2';
const authStorageKey = 'verola.authUser.v2';
const activeBusinessStorageKey = 'verola.activeBusinessId.v2';
const jobsStorageKey = 'verola.jobs.v2';
const rosterStorageKey = 'verola.rosters.v2';
const workflowStorageKey = 'verola.workflowStages.v2';
const smsTemplateStorageKey = 'verola.smsTemplates.v2';

const demoUsers: AuthUser[] = [
  { email: 'moey1722001@gmail.com', name: 'Platform Owner', role: 'super' },
  { email: 'owner@freshfold.test', name: 'Fresh Fold Admin', role: 'admin', businessId: 'fresh-fold' },
  { email: 'admin@rapidauto.test', name: 'Rapid Auto Admin', role: 'admin', businessId: 'rapid-auto' },
  { email: 'mia@freshfold.test', name: 'Mia Taylor', role: 'staff', businessId: 'fresh-fold' }
];

const demoSuperAdminPasswordHash = '6d7c8cf940fcbb15e4a46bb697fd8560022500ffe874e50117a292f8cbc6a469';
const demoEmailByRole: Record<UserRole, string> = {
  super: 'moey1722001@gmail.com',
  admin: 'owner@freshfold.test',
  staff: 'mia@freshfold.test'
};
const demoHighlights = [
  'White-label dashboard for laundromats, mechanics, groomers, cleaners, clinics, and repair shops',
  'Simple job workflow: collected, in progress, ready for pickup, completed',
  'Customer updates are previewed, logged, and sent only when the business connects its own SMS provider',
  'Staff can see today’s work, notes, payments, rosters, and shift clock status'
];
const defaultSmsTemplates: Record<JobStatus, string> = {
  collected: 'Hi {{customer}}, {{business}} has received your order. We will update you soon.',
  in_progress: 'Hi {{customer}}, your order at {{business}} is now in progress.',
  ready_for_pickup: 'Hi {{customer}}, your order is ready for pickup at {{business}}.',
  completed: 'Thanks {{customer}}. Your order with {{business}} is complete.'
};

function portalFromPath(pathname: string): Portal {
  if (pathname.startsWith('/super-admin')) return 'super';
  if (pathname.startsWith('/staff')) return 'staff';
  return 'admin';
}

function inviteTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/(?:invite|setup-business)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getInitialPath() {
  const redirectPath = new URLSearchParams(window.location.search).get('redirect');
  return redirectPath?.startsWith('/') ? redirectPath : window.location.pathname;
}

function businessIdFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `business-${Date.now()}`;
}

function debugInvite(message: string, details?: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[invite] ${message}`, details ?? '');
  }
}

function debugPersistence(message: string, details?: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[persistence] ${message}`, details ?? '');
  }
}

function generateInviteToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function formatRelativeDate(value?: string) {
  if (!value || value.startsWith('Demo') || value.includes('created')) return value || 'Just now';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  const diff = time - Date.now();
  const abs = Math.abs(diff);
  const day = 24 * 60 * 60 * 1000;
  if (abs < 60 * 60 * 1000) return diff < 0 ? 'Just now' : 'Within the hour';
  if (abs < day) return diff < 0 ? 'Today' : 'Later today';
  const days = Math.round(abs / day);
  return diff < 0 ? `${days}d ago` : `in ${days}d`;
}

function readStoredArray<T>(key: string, fallback: T[]) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T[] : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readStoredValue<T>(key: string, fallback: T) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T | null) {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

type OrganisationDocument = {
  $id: string;
  name: string;
  industry: string;
  location?: string;
  isEnabled?: boolean;
  plan?: 'starter' | 'growth' | 'scale';
  logoFileId?: string;
  logoUrl?: string;
  logoName?: string;
  primaryColour?: string;
  accentColour?: string;
  messagingEnabled?: boolean;
  smsProvider?: SmsProvider;
  smsSenderName?: string;
  smsSetupStatus?: SmsSetupStatus;
  adminEmail?: string;
  contactName?: string;
  contactPhone?: string;
};

function logoViewUrl(fileId?: string) {
  if (!fileId || !appwriteLogoBucketId) return undefined;
  return String(storage.getFileView(appwriteLogoBucketId, fileId));
}

function businessFromOrganisationDocument(document: OrganisationDocument): Business {
  const sender = (document.smsSenderName || document.name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'VEROLA');
  return {
    id: document.$id,
    name: document.name,
    industry: document.industry || 'Service business',
    location: document.location || 'New location',
    plan: document.plan === 'scale' ? 'Scale' : document.plan === 'growth' ? 'Growth' : 'Starter',
    active: document.isEnabled ?? true,
    staff: 0,
    sms: 0,
    jobs: 0,
    primary: document.primaryColour || platformBrand.primary,
    accent: document.accentColour || platformBrand.accent,
    sender,
    logoName: document.logoName,
    logoFileId: document.logoFileId,
    logoUrl: document.logoUrl || logoViewUrl(document.logoFileId),
    adminEmail: document.adminEmail,
    contactName: document.contactName,
    contactPhone: document.contactPhone,
    messagingEnabled: document.messagingEnabled ?? false,
    smsProvider: document.smsProvider ?? null,
    smsSenderName: sender,
    smsSetupStatus: document.smsSetupStatus ?? 'not_configured'
  };
}

function organisationPayloadFromBusiness(business: Business) {
  return {
    name: business.name,
    industry: business.industry,
    location: business.location,
    isEnabled: business.active,
    plan: business.plan.toLowerCase(),
    subscriptionStatus: 'trialing',
    logoFileId: business.logoFileId,
    logoUrl: business.logoUrl?.startsWith('data:') ? undefined : business.logoUrl,
    logoName: business.logoName,
    primaryColour: business.primary,
    accentColour: business.accent,
    messagingEnabled: business.messagingEnabled,
    smsProvider: business.smsProvider ?? undefined,
    smsSenderName: business.smsSenderName,
    smsSetupStatus: business.smsSetupStatus,
    teamId: business.id,
    adminEmail: business.adminEmail,
    contactName: business.contactName,
    contactPhone: business.contactPhone
  };
}

async function fetchPersistedBusinesses() {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return [];
  const response = await databases.listDocuments(appwriteDatabaseId, appwriteOrganisationCollectionId);
  const businesses = response.documents.map((document) => businessFromOrganisationDocument(document as unknown as OrganisationDocument));
  debugPersistence('branding fetched after refresh', { count: businesses.length });
  return businesses;
}

async function persistBusinessDocument(business: Business) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  const payload = organisationPayloadFromBusiness(business);
  try {
    await databases.updateDocument(appwriteDatabaseId, appwriteOrganisationCollectionId, business.id, payload);
  } catch {
    await databases.createDocument(appwriteDatabaseId, appwriteOrganisationCollectionId, business.id, payload);
  }
  debugPersistence('business created', { businessId: business.id, name: business.name });
  return true;
}

async function patchBusinessDocument(businessId: string, patch: Partial<Business>) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  const payload: Record<string, unknown> = {};
  const has = (key: keyof Business) => Object.prototype.hasOwnProperty.call(patch, key);
  if (patch.name) payload.name = patch.name;
  if (patch.industry) payload.industry = patch.industry;
  if (patch.location) payload.location = patch.location;
  if (patch.active !== undefined) payload.isEnabled = patch.active;
  if (patch.plan) payload.plan = patch.plan.toLowerCase();
  if (patch.primary) payload.primaryColour = patch.primary;
  if (patch.accent) payload.accentColour = patch.accent;
  if (has('logoFileId')) payload.logoFileId = patch.logoFileId || '';
  if (has('logoUrl')) payload.logoUrl = patch.logoUrl?.startsWith('data:') ? '' : patch.logoUrl || '';
  if (has('logoName')) payload.logoName = patch.logoName || '';
  if (patch.messagingEnabled !== undefined) payload.messagingEnabled = patch.messagingEnabled;
  if (patch.smsProvider !== undefined) payload.smsProvider = patch.smsProvider ?? undefined;
  if (patch.smsSenderName) payload.smsSenderName = patch.smsSenderName;
  if (patch.smsSetupStatus) payload.smsSetupStatus = patch.smsSetupStatus;
  if (patch.adminEmail !== undefined) payload.adminEmail = patch.adminEmail;
  if (patch.contactName !== undefined) payload.contactName = patch.contactName;
  if (patch.contactPhone !== undefined) payload.contactPhone = patch.contactPhone;
  await databases.updateDocument(appwriteDatabaseId, appwriteOrganisationCollectionId, businessId, payload);
  return true;
}

function inviteStatus(invite: OrganisationInvite): InviteStatus {
  if (invite.status === 'accepted') return 'accepted';
  return new Date(invite.expiresAt).getTime() < Date.now() ? 'expired' : 'pending';
}

function normalizeInvite(invite: Partial<OrganisationInvite> & { id: string; businessId: string; businessName: string; adminEmail: string }): OrganisationInvite {
  const createdAt = invite.createdAt || new Date().toISOString();
  const token = invite.token || invite.id || generateInviteToken();
  return {
    id: invite.id || `INV-${Date.now()}`,
    token,
    businessId: invite.businessId,
    businessName: invite.businessName,
    contactName: invite.contactName || 'Business owner',
    adminEmail: invite.adminEmail,
    phone: invite.phone || '',
    role: 'business_admin',
    status: invite.status === 'accepted' ? 'accepted' : invite.status === 'expired' ? 'expired' : 'pending',
    sentAt: invite.sentAt || 'Imported invite',
    createdAt,
    expiresAt: invite.expiresAt || addDays(new Date(createdAt), 14),
    acceptedAt: invite.acceptedAt
  };
}

function businessFromInvite(invite: OrganisationInvite): Business {
  const sender = invite.businessName.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'VEROLA';
  return {
    id: invite.businessId,
    name: invite.businessName,
    industry: 'Service business',
    location: 'New location',
    plan: 'Starter',
    active: true,
    staff: 1,
    sms: 0,
    jobs: 0,
    primary: '#4f46e5',
    accent: '#06b6d4',
    sender,
    adminEmail: invite.adminEmail,
    messagingEnabled: false,
    smsProvider: null,
    smsSenderName: sender,
    smsSetupStatus: 'not_configured',
    contactName: invite.contactName,
    contactPhone: invite.phone
  };
}

function brandFromBusiness(business?: Business): OrganisationBrand {
  if (!business) return platformBrand;
  const mainLogoUrl = business.logoUrl;
  return {
    name: business.name,
    tagline: `${business.industry} · ${business.location}`,
    logoUrl: mainLogoUrl,
    appIconUrl: business.appIconUrl || mainLogoUrl,
    faviconUrl: business.faviconUrl || business.appIconUrl || mainLogoUrl,
    lightLogoUrl: business.lightLogoUrl || mainLogoUrl,
    darkLogoUrl: business.darkLogoUrl || mainLogoUrl,
    emailHeaderLogoUrl: business.emailHeaderLogoUrl || mainLogoUrl,
    primary: business.primary || platformBrand.primary,
    accent: business.accent || platformBrand.accent,
    poweredBy: 'Verola'
  };
}

function inviteFromUrl(inviteId: string): OrganisationInvite | undefined {
  const params = new URLSearchParams(window.location.search);
  const businessName = params.get('business');
  const adminEmail = params.get('email');
  if (!inviteId || !businessName || !adminEmail) return undefined;

  return {
    id: inviteId,
    token: inviteId,
    businessId: params.get('businessId') || businessIdFromName(businessName),
    businessName,
    contactName: params.get('contact') || 'Business owner',
    adminEmail,
    phone: params.get('phone') || '',
    role: 'business_admin',
    status: 'pending',
    sentAt: 'Invite link',
    createdAt: params.get('created') || new Date().toISOString(),
    expiresAt: params.get('expires') || addDays(new Date(), 14)
  };
}

function buildInviteUrl(invite: OrganisationInvite) {
  const baseUrl = appBaseUrl || window.location.origin;
  const params = new URLSearchParams({
    businessId: invite.businessId,
    business: invite.businessName,
    email: invite.adminEmail,
    contact: invite.contactName || 'Business owner',
    role: invite.role,
    expires: invite.expiresAt,
    created: invite.createdAt,
    source: 'verola'
  });
  if (invite.phone) params.set('phone', invite.phone);
  return `${baseUrl}/invite/${encodeURIComponent(invite.token)}?${params.toString()}`;
}

function buildPersonalisedInviteMessage(invite: OrganisationInvite) {
  const url = buildInviteUrl(invite);
  const greeting = invite.contactName && invite.contactName !== 'Business owner' ? `Hi ${invite.contactName},` : 'Hi,';
  const body = [
    greeting,
    '',
    `Verola has created a branded business portal for ${invite.businessName}.`,
    '',
    'Use this secure setup link to create your Business Admin account:',
    url,
    '',
    'Once setup is complete, you can add customer jobs, track progress, manage staff workflow, and prepare customer updates from your own branded dashboard.',
    '',
    `This invite is for ${invite.adminEmail} and expires on ${new Date(invite.expiresAt).toLocaleDateString()}.`,
    '',
    'Powered by Verola'
  ].join('\n');

  return {
    subject: `Set up ${invite.businessName} on Verola`,
    body,
    url
  };
}

function inviteMailtoHref(invite: OrganisationInvite) {
  const { subject, body } = buildPersonalisedInviteMessage(invite);
  return `mailto:${encodeURIComponent(invite.adminEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function passwordDigest(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read logo file.'));
    reader.readAsDataURL(file);
  });
}

function App() {
  const initialPath = getInitialPath();
  const isOverviewPath = initialPath === '/' || initialPath.startsWith('/overview');
  const initialPortal = portalFromPath(initialPath);
  const [portal, setPortal] = useState<Portal>(() => portalFromPath(initialPath));
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readStoredValue<AuthUser | null>(authStorageKey, null));
  const [authReady, setAuthReady] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>(() => initialPortal);
  const [loginEmail, setLoginEmail] = useState(demoEmailByRole[initialPortal]);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [copiedInviteId, setCopiedInviteId] = useState('');
  const [inviteSendingId, setInviteSendingId] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>(() => readStoredArray(businessStorageKey, initialBusinesses));
  const [businessesLoading, setBusinessesLoading] = useState(Boolean(hasAppwriteConfig));
  const [activeBusinessId, setActiveBusinessId] = useState(() => readStoredValue(activeBusinessStorageKey, 'fresh-fold'));
  const [jobs, setJobs] = useState<Job[]>(() => readStoredArray(jobsStorageKey, seedJobs));
  const [rosterShifts, setRosterShifts] = useState<RosterShift[]>(() => readStoredArray(rosterStorageKey, seedRosterShifts));
  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(seedJobs[0].id);
  const [newCustomer, setNewCustomer] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobNotes, setNewJobNotes] = useState('');
  const [staffMembers, setStaffMembers] = useState(staff);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessContactName, setNewBusinessContactName] = useState('');
  const [newBusinessIndustry, setNewBusinessIndustry] = useState('');
  const [newBusinessLocation, setNewBusinessLocation] = useState('');
  const [newBusinessPhone, setNewBusinessPhone] = useState('');
  const [newBusinessAdminEmail, setNewBusinessAdminEmail] = useState('');
  const [createdUsers, setCreatedUsers] = useState<AuthUser[]>(() => readStoredArray(userStorageKey, []));
  const [setupDraft, setSetupDraft] = useState<SetupDraft>({ name: '', password: '', error: '' });
  const [organisationInvites, setOrganisationInvites] = useState<OrganisationInvite[]>(() => readStoredArray<OrganisationInvite>(inviteStorageKey, [
    {
      id: 'INV-101',
      token: 'demo-accepted-fresh-fold',
      businessId: 'fresh-fold',
      businessName: 'Fresh Fold Laundry',
      contactName: 'Fresh Fold Owner',
      adminEmail: 'owner@freshfold.test',
      phone: '+61 400 000 101',
      role: 'business_admin',
      status: 'accepted',
      sentAt: 'Demo seed',
      createdAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
      acceptedAt: '2026-05-01T00:00:00.000Z'
    },
    {
      id: 'INV-102',
      token: 'demo-pending-rapid-auto',
      businessId: 'rapid-auto',
      businessName: 'Rapid Auto Care',
      contactName: 'Rapid Auto Admin',
      adminEmail: 'admin@rapidauto.test',
      phone: '+61 400 000 102',
      role: 'business_admin',
      status: 'pending',
      sentAt: 'Demo seed',
      createdAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z'
    }
  ]).map((invite) => normalizeInvite(invite)));
  const [rosterStaff, setRosterStaff] = useState(staff[2].name);
  const [rosterDate, setRosterDate] = useState('2026-05-28');
  const [rosterStart, setRosterStart] = useState('9:00 AM');
  const [rosterEnd, setRosterEnd] = useState('5:00 PM');
  const [rosterArea, setRosterArea] = useState('Front counter');
  const [workflowStages, setWorkflowStages] = useState<Record<JobStatus, WorkflowStage>>(() => readStoredValue(workflowStorageKey, defaultWorkflowStages));
  const [smsNotice, setSmsNotice] = useState('');
  const [smsPreview, setSmsPreview] = useState<SmsPreview | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, { provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string }>>({});
  const [smsTemplates, setSmsTemplates] = useState<Record<JobStatus, string>>(() => readStoredValue(smsTemplateStorageKey, defaultSmsTemplates));

  const lockedBusinessId = authUser?.role === 'admin' || authUser?.role === 'staff' ? authUser.businessId : undefined;
  const resolvedBusinessId = lockedBusinessId ?? activeBusinessId;
  const activeBusiness = businesses.find((business) => business.id === resolvedBusinessId) ?? businesses[0];
  const visibleJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.businessId === activeBusiness.id)
        .filter((job) => `${job.customer} ${job.phone} ${job.item} ${job.serviceType} ${job.id}`.toLowerCase().includes(query.toLowerCase())),
    [activeBusiness.id, jobs, query]
  );
  const activeRosterShifts = useMemo(
    () => rosterShifts.filter((shift) => shift.businessId === activeBusiness.id),
    [activeBusiness.id, rosterShifts]
  );
  const selectedJob = visibleJobs.find((job) => job.id === selectedJobId) ?? visibleJobs[0];
  const inferredAdminUsers = businesses
    .filter((business) => business.adminEmail)
    .map((business) => ({
      email: business.adminEmail ?? '',
      name: business.contactName || `${business.name} Admin`,
      role: 'admin' as UserRole,
      businessId: business.id
    }));
  const loginUsers = [...demoUsers, ...createdUsers, ...inferredAdminUsers];
  const loginUser = loginUsers.find((candidate) => candidate.email === loginEmail.trim().toLowerCase() && candidate.role === loginRole);
  const loginBusinessByEmail = loginRole === 'admin' ? businesses.find((business) => business.adminEmail?.toLowerCase() === loginEmail.trim().toLowerCase()) : undefined;
  const loginBusiness = loginUser?.businessId ? businesses.find((business) => business.id === loginUser.businessId) : loginBusinessByEmail;
  const activeBrand = brandFromBusiness(activeBusiness);
  const loginBrand = loginRole === 'super' ? platformBrand : brandFromBusiness(loginBusiness);
  const canPreviewPortals = Boolean(authUser && (authUser.role === 'super' || import.meta.env.DEV || !hasAppwriteConfig));
  const visiblePortals = canPreviewPortals ? (Object.keys(portalMeta) as Portal[]) : authUser ? [authUser.role] : [];
  const activeInviteToken = inviteTokenFromPath(currentPath);
  const activeInvite = activeInviteToken ? organisationInvites.find((invite) => invite.token === activeInviteToken) ?? inviteFromUrl(activeInviteToken) : undefined;
  const inviteBusiness = activeInvite ? businesses.find((business) => business.id === activeInvite.businessId) ?? businessFromInvite(activeInvite) : undefined;
  const customerTrackJobId = currentPath.match(/^\/track\/([^/]+)/)?.[1] ? decodeURIComponent(currentPath.match(/^\/track\/([^/]+)/)?.[1] ?? '') : '';
  const customerTrackJob = customerTrackJobId ? jobs.find((job) => job.id === customerTrackJobId) : undefined;
  const customerTrackBusiness = customerTrackJob ? businesses.find((business) => business.id === customerTrackJob.businessId) : undefined;

  function resetDemoData() {
    [businessStorageKey, inviteStorageKey, userStorageKey, authStorageKey, activeBusinessStorageKey, jobsStorageKey, rosterStorageKey, workflowStorageKey, smsTemplateStorageKey].forEach((key) => localStorage.removeItem(key));
    window.location.href = '/overview';
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const storedUser = readStoredValue<AuthUser | null>(authStorageKey, null);
      const storedBusinessId = readStoredValue(activeBusinessStorageKey, 'fresh-fold');

      if (storedUser) {
        setAuthUser(storedUser);
        setPortal(storedUser.role);
        setLoginRole(storedUser.role);
        setLoginEmail(storedUser.email);
      }
      if (storedBusinessId) setActiveBusinessId(storedBusinessId);

      if (hasAppwriteConfig) {
        try {
          const sessionUser = await account.get();
          if (!storedUser) {
            const userWithMeta = sessionUser as typeof sessionUser & { labels?: string[]; prefs?: { role?: UserRole; businessId?: string; name?: string } };
            const roleFromMeta = userWithMeta.prefs?.role || (userWithMeta.labels?.includes('super_admin') ? 'super' : userWithMeta.labels?.includes('staff') ? 'staff' : userWithMeta.labels?.includes('business_admin') ? 'admin' : undefined);
            const matchedBusiness = businesses.find((business) => business.adminEmail?.toLowerCase() === sessionUser.email.toLowerCase());
            if (roleFromMeta || matchedBusiness) {
              const restoredUser: AuthUser = {
                email: sessionUser.email,
                name: userWithMeta.prefs?.name || sessionUser.name || sessionUser.email,
                role: roleFromMeta || 'admin',
                businessId: userWithMeta.prefs?.businessId || matchedBusiness?.id
              };
              setAuthUser(restoredUser);
              setPortal(restoredUser.role);
              setLoginRole(restoredUser.role);
              setLoginEmail(restoredUser.email);
              if (restoredUser.businessId) setActiveBusinessId(restoredUser.businessId);
            }
          }
          debugPersistence('Appwrite session restored', { userId: sessionUser.$id, email: sessionUser.email });
        } catch {
          debugPersistence('No Appwrite session cookie found; keeping remembered demo session if present');
        }
      }

      if (!cancelled) setAuthReady(true);
    }

    hydrateAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasAppwriteConfig) {
      setBusinessesLoading(false);
      return;
    }

    setBusinessesLoading(true);
    fetchPersistedBusinesses()
      .then((persistedBusinesses) => {
        if (cancelled) return;
        if (persistedBusinesses.length) {
          setBusinesses(persistedBusinesses);
          setActiveBusinessId((current) => persistedBusinesses.some((business) => business.id === current) ? current : persistedBusinesses[0].id);
        }
        debugPersistence('organisation loaded after login', { count: persistedBusinesses.length });
      })
      .catch((error) => {
        debugPersistence('branding fetch failed, using local fallback', error instanceof Error ? error.message : error);
      })
      .finally(() => {
        if (!cancelled) setBusinessesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStoredArray(businessStorageKey, businesses);
  }, [businesses]);

  useEffect(() => {
    writeStoredArray(inviteStorageKey, organisationInvites);
  }, [organisationInvites]);

  useEffect(() => {
    writeStoredArray(userStorageKey, createdUsers);
  }, [createdUsers]);

  useEffect(() => {
    writeStoredValue(authStorageKey, authUser);
  }, [authUser]);

  useEffect(() => {
    writeStoredValue(activeBusinessStorageKey, activeBusinessId);
  }, [activeBusinessId]);

  useEffect(() => {
    writeStoredArray(jobsStorageKey, jobs);
  }, [jobs]);

  useEffect(() => {
    writeStoredArray(rosterStorageKey, rosterShifts);
  }, [rosterShifts]);

  useEffect(() => {
    writeStoredValue(workflowStorageKey, workflowStages);
  }, [workflowStages]);

  useEffect(() => {
    writeStoredValue(smsTemplateStorageKey, smsTemplates);
  }, [smsTemplates]);

  useEffect(() => {
    if (!activeInviteToken || activeInvite || !hasAppwriteConfig || !appwriteInviteFunctionId) return;

    let cancelled = false;
    debugInvite('invite lookup requested', { token: activeInviteToken });
    functions.createExecution(
      appwriteInviteFunctionId,
      JSON.stringify({ action: 'lookup_invite', token: activeInviteToken }),
      false,
      '/',
      ExecutionMethod.POST,
      { 'content-type': 'application/json' }
    )
      .then((execution) => {
        if (cancelled) return;
        const responseBody = (execution as { responseBody?: string }).responseBody;
        const payload = responseBody ? JSON.parse(responseBody) as { invite?: OrganisationInvite } : {};
        if (payload.invite) {
          const invite = normalizeInvite(payload.invite);
          setOrganisationInvites((current) => [invite, ...current.filter((item) => item.token !== invite.token)]);
          debugInvite('invite lookup success', { token: invite.token, businessId: invite.businessId });
        } else {
          debugInvite('invite lookup failure', { token: activeInviteToken });
        }
      })
      .catch(() => debugInvite('invite lookup failure', { token: activeInviteToken }));

    return () => {
      cancelled = true;
    };
  }, [activeInviteToken, activeInvite]);

  useEffect(() => {
    if (initialPath !== window.location.pathname) {
      window.history.replaceState({}, '', initialPath);
    }
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setPortal(portalFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [initialPath]);

  useEffect(() => {
    if (!authUser) return;
    if (!canPreviewPortals && authUser.role !== portal) {
      setPortal(authUser.role);
      window.history.replaceState({}, '', portalPaths[authUser.role]);
    }
    if ((authUser.role === 'admin' || authUser.role === 'staff') && authUser.businessId) {
      setActiveBusinessId(authUser.businessId);
    }
  }, [authUser, portal, canPreviewPortals]);

  function openPortal(nextPortal: Portal) {
    if (authUser && !canPreviewPortals && authUser.role !== nextPortal) return;
    setPortal(nextPortal);
    setShowNotifications(false);
    const nextPath = portalPaths[nextPortal];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
      setCurrentPath(nextPath);
    }
  }

  async function login() {
    const email = loginEmail.trim().toLowerCase();
    const user = loginUsers.find((candidate) => candidate.email === email && candidate.role === loginRole);
    const passwordOk = user?.role === 'super' ? await passwordDigest(loginPassword) === demoSuperAdminPasswordHash : Boolean(loginPassword.trim());
    const organisationAvailable = !user?.businessId || businesses.some((business) => business.id === user.businessId && business.active);

    if (!user || !passwordOk || !organisationAvailable) {
      setLoginError('Check the email, password, and role. This account is not assigned to that dashboard.');
      return;
    }

    setAuthUser(user);
    setLoginError('');
    setLoginPassword('');
    setPortal(user.role);
    if (user.businessId) setActiveBusinessId(user.businessId);
    window.history.replaceState({}, '', portalPaths[user.role]);
    setCurrentPath(portalPaths[user.role]);
  }

  function logout() {
    setAuthUser(null);
    writeStoredValue(authStorageKey, null);
    setPortal('admin');
    setLoginRole('admin');
    setLoginEmail(demoEmailByRole.admin);
    setLoginPassword('');
    window.history.replaceState({}, '', '/login');
    setCurrentPath('/login');
  }

  async function copyInviteLink(inviteId: string) {
    const invite = organisationInvites.find((item) => item.id === inviteId);
    if (!invite) return;
    const url = buildInviteUrl(invite);
    await navigator.clipboard?.writeText(url);
    setCopiedInviteId(inviteId);
    setInviteNotice('Invite link copied.');
    debugInvite('invite URL copied', { token: invite.token, businessId: invite.businessId, url });
  }

  async function sendInviteEmailForInvite(invite: OrganisationInvite) {
    const { subject, body, url } = buildPersonalisedInviteMessage(invite);

    setInviteSendingId(invite.id);
    setInviteNotice('');

    try {
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        const execution = await functions.createExecution(
          appwriteInviteFunctionId,
          JSON.stringify({
            action: 'send_invite_email',
            inviteId: invite.id,
            token: invite.token,
            businessId: invite.businessId,
            businessName: invite.businessName,
            contactName: invite.contactName,
            adminEmail: invite.adminEmail,
            phone: invite.phone,
            role: invite.role,
            inviteUrl: url,
            subject,
            messageBody: body,
            expiresAt: invite.expiresAt,
            logoUrl: businesses.find((business) => business.id === invite.businessId)?.logoUrl
          }),
          false,
          '/',
          ExecutionMethod.POST,
          { 'content-type': 'application/json' }
        );
        const result = execution as { responseStatusCode?: number; responseBody?: string; status?: string };
        const payload = result.responseBody ? JSON.parse(result.responseBody) as { emailSent?: boolean; emailConfigured?: boolean; error?: string } : {};
        if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.emailSent === false || payload.emailConfigured === false || payload.error) {
          throw new Error(payload.error || 'Invite email provider is not configured.');
        }
        setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email sent just now' } : item)));
        setInviteNotice(`Invite email sent to ${invite.adminEmail}.`);
        debugInvite('invite email sent', { token: invite.token, businessId: invite.businessId });
        return;
      }

      await navigator.clipboard?.writeText(`${subject}\n\n${body}`);
      setCopiedInviteId(invite.id);
      setInviteNotice('Email sending is not configured. A personalised Verola invite was copied so you can send it manually.');
      debugInvite('email sending unavailable, personalised invite copied', { token: invite.token, businessId: invite.businessId });
    } catch (error) {
      await navigator.clipboard?.writeText(`${subject}\n\n${body}`);
      setCopiedInviteId(invite.id);
      setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email failed - link copied' } : item)));
      setInviteNotice(`Invite email could not be sent. The personalised invite was copied instead.${error instanceof Error ? ` ${error.message}` : ''}`);
    } finally {
      setInviteSendingId('');
    }
  }

  async function sendInviteEmail(inviteId: string) {
    const invite = organisationInvites.find((item) => item.id === inviteId);
    if (!invite) return;
    await sendInviteEmailForInvite(invite);
  }

  async function updateBusinessBrand(businessId: string, patch: Partial<Pick<Business, 'primary' | 'accent'>>) {
    setBusinesses((current) => current.map((business) => (business.id === businessId ? { ...business, ...patch } : business)));
    try {
      if (await patchBusinessDocument(businessId, patch)) {
        debugPersistence('branding saved', { businessId, ...patch });
      }
      setInviteNotice('Brand colours updated for this organisation.');
    } catch (error) {
      debugPersistence('branding save failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Brand colours updated locally. Appwrite persistence needs database permissions or the organisation function.');
    }
  }

  async function completeInviteSetup(inviteToken: string) {
    const invite = organisationInvites.find((item) => item.token === inviteToken) ?? inviteFromUrl(inviteToken);
    if (!invite) return;
    const status = inviteStatus(invite);
    const adminName = setupDraft.name.trim();
    const password = setupDraft.password.trim();

    debugInvite(status === 'pending' ? 'invite lookup success' : 'invite lookup blocked', {
      token: invite.token,
      businessId: invite.businessId,
      status
    });

    if (status !== 'pending') {
      setSetupDraft((current) => ({ ...current, error: status === 'accepted' ? 'This invite has already been accepted.' : 'This invite has expired.' }));
      return;
    }

    if (!adminName || password.length < 8) {
      setSetupDraft((current) => ({ ...current, error: 'Enter your name and a password with at least 8 characters.' }));
      return;
    }

    try {
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        const execution = await functions.createExecution(
          appwriteInviteFunctionId,
          JSON.stringify({
            action: 'accept_invite',
            token: invite.token,
            adminName,
            adminEmail: invite.adminEmail,
            password,
            businessId: invite.businessId
          }),
          false,
          '/',
          ExecutionMethod.POST,
          { 'content-type': 'application/json' }
        );
        const result = execution as { responseStatusCode?: number; responseBody?: string };
        const payload = result.responseBody ? JSON.parse(result.responseBody) as { accepted?: boolean; error?: string } : {};
        if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.accepted === false || payload.error) {
          throw new Error(payload.error || 'Invite setup function failed.');
        }
      }
    } catch (error) {
      debugInvite('invite accept failed, continuing with local setup fallback', {
        token: invite.token,
        businessId: invite.businessId,
        error: error instanceof Error ? error.message : error
      });
    }

    setOrganisationInvites((current) => {
      const exists = current.some((item) => item.token === inviteToken);
      if (exists) return current.map((item) => (item.token === inviteToken ? { ...item, status: 'accepted', acceptedAt: new Date().toISOString() } : item));
      return [{ ...invite, status: 'accepted', sentAt: 'Accepted from invite link' }, ...current];
    });
    setBusinesses((current) => (current.some((business) => business.id === invite.businessId) ? current : [businessFromInvite(invite), ...current]));
    const user: AuthUser = {
      email: invite.adminEmail,
      name: adminName,
      role: 'admin',
      businessId: invite.businessId
    };
    setCreatedUsers((current) => [user, ...current.filter((candidate) => candidate.email !== user.email)]);
    setAuthUser(user);
    setActiveBusinessId(invite.businessId);
    setPortal('admin');
    setLoginError('');
    setSetupDraft({ name: '', password: '', error: '' });
    debugInvite('invite accepted and account linked to organisation', { token: invite.token, businessId: invite.businessId, email: invite.adminEmail });
    window.history.replaceState({}, '', '/business-admin');
    setCurrentPath('/business-admin');
  }

  async function addBusiness() {
    const name = newBusinessName.trim();
    const contactName = newBusinessContactName.trim();
    const email = newBusinessAdminEmail.trim().toLowerCase();
    if (!name) return;

    const id = businessIdFromName(name);
    const now = new Date();
    const token = generateInviteToken();
    const business: Business = {
      id,
      name,
      industry: newBusinessIndustry.trim() || 'Service business',
      location: newBusinessLocation.trim() || 'New location',
      plan: 'Starter',
      active: true,
      staff: 1,
      sms: 0,
      jobs: 0,
      primary: '#4f46e5',
      accent: '#06b6d4',
      sender: name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'VEROLA',
      adminEmail: email,
      contactName,
      contactPhone: newBusinessPhone.trim(),
      messagingEnabled: false,
      smsProvider: null,
      smsSenderName: name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'VEROLA',
      smsSetupStatus: 'not_configured'
    };
    const invite: OrganisationInvite = {
      id: `INV-${Date.now()}`,
      token,
      businessId: business.id,
      businessName: business.name,
      contactName: contactName || 'Business owner',
      adminEmail: business.adminEmail ?? '',
      phone: newBusinessPhone.trim(),
      role: 'business_admin',
      status: 'pending',
      sentAt: 'Invite created',
      createdAt: now.toISOString(),
      expiresAt: addDays(now, 14)
    };

    setBusinesses((current) => [business, ...current]);
    try {
      await persistBusinessDocument(business);
    } catch (error) {
      debugPersistence('business create persistence failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Business created locally. Appwrite persistence needs database permissions or the organisation function.');
    }
    if (business.adminEmail) {
      setOrganisationInvites((current) => [invite, ...current]);
    }
    debugInvite('invite token created', { token: invite.token, businessId: business.id, email: invite.adminEmail, expiresAt: invite.expiresAt });
    debugInvite('invite URL generated', { token: invite.token, url: buildInviteUrl(invite) });
    setActiveBusinessId(business.id);
    setNewBusinessName('');
    setNewBusinessContactName('');
    setNewBusinessIndustry('');
    setNewBusinessLocation('');
    setNewBusinessPhone('');
    setNewBusinessAdminEmail('');
    if (business.adminEmail) await sendInviteEmailForInvite(invite);
  }

  async function deleteBusiness(businessId: string) {
    const business = businesses.find((item) => item.id === businessId);
    if (!business || businesses.length <= 1) return;
    if (!window.confirm(`Delete ${business.name}? This removes its jobs, rosters, and pending invites from this workspace.`)) return;

    const remainingBusinesses = businesses.filter((item) => item.id !== businessId);
    const nextActiveBusiness = remainingBusinesses[0];

    setBusinesses(remainingBusinesses);
    setJobs((current) => current.filter((job) => job.businessId !== businessId));
    setRosterShifts((current) => current.filter((shift) => shift.businessId !== businessId));
    setOrganisationInvites((current) => current.filter((invite) => invite.businessId !== businessId));
    setProviderDrafts((drafts) => {
      const { [businessId]: _removed, ...remainingDrafts } = drafts;
      return remainingDrafts;
    });
    setActiveBusinessId(nextActiveBusiness.id);
    try {
      if (hasAppwriteConfig && appwriteDatabaseId) {
        await databases.deleteDocument(appwriteDatabaseId, appwriteOrganisationCollectionId, businessId);
        debugPersistence('business deleted', { businessId });
      }
    } catch (error) {
      debugPersistence('business delete persistence failed, local fallback active', error instanceof Error ? error.message : error);
    }
  }

  async function uploadBusinessLogo(businessId: string, file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setInviteNotice('Logo upload failed. Use a PNG, JPG, SVG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setInviteNotice('Logo upload failed. Choose an image smaller than 2 MB.');
      return;
    }
    let logoUrl = await fileToDataUrl(file);
    let logoFileId: string | undefined;

    try {
      if (hasAppwriteConfig && appwriteLogoBucketId) {
        const uploadedFile = await storage.createFile(appwriteLogoBucketId, ID.unique(), file);
        logoFileId = uploadedFile.$id;
        logoUrl = logoViewUrl(logoFileId) || logoUrl;
        debugPersistence('logo uploaded', { businessId, fileId: logoFileId, fileName: file.name });
        debugPersistence('logo URL generated', { businessId, logoUrl });
      }
    } catch (error) {
      debugPersistence('logo upload storage failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Logo preview saved locally. Appwrite Storage needs the logo bucket and permissions configured.');
    }

    const patch = {
      logoName: file.name,
      logoUrl,
      logoFileId
    };
    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              ...patch
            }
          : business
      )
    );
    try {
      if (await patchBusinessDocument(businessId, patch)) {
        const persistedBusinesses = await fetchPersistedBusinesses();
        if (persistedBusinesses.length) setBusinesses(persistedBusinesses);
        debugPersistence('branding saved', { businessId, logoFileId });
      }
      setInviteNotice('Logo saved. It will appear across this organisation portal.');
    } catch (error) {
      debugPersistence('branding save failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Logo updated locally. Appwrite persistence needs database/storage permissions.');
    }
  }

  async function removeBusinessLogo(businessId: string) {
    const currentBusiness = businesses.find((business) => business.id === businessId);
    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              logoName: undefined,
              logoUrl: undefined,
              logoFileId: undefined
            }
          : business
      )
    );
    try {
      if (currentBusiness?.logoFileId && appwriteLogoBucketId) {
        await storage.deleteFile(appwriteLogoBucketId, currentBusiness.logoFileId);
      }
      if (await patchBusinessDocument(businessId, { logoName: undefined, logoUrl: undefined, logoFileId: undefined })) {
        debugPersistence('branding saved', { businessId, logoRemoved: true });
      }
      setInviteNotice('Logo removed. This business now uses the Verola fallback mark.');
    } catch (error) {
      debugPersistence('logo remove persistence failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Logo removed locally. Appwrite persistence needs database/storage permissions.');
    }
  }

  function getProviderDraft(business: Business) {
    return providerDrafts[business.id] ?? {
      provider: business.smsProvider ?? 'clicksend',
      senderName: business.smsSenderName || business.sender,
      username: '',
      apiKey: '',
      fromNumber: ''
    };
  }

  function updateProviderDraft(businessId: string, patch: Partial<{ provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string }>) {
    setProviderDrafts((drafts) => ({
      ...drafts,
      [businessId]: {
        provider: drafts[businessId]?.provider ?? 'clicksend',
        senderName: drafts[businessId]?.senderName ?? activeBusiness.smsSenderName,
        username: drafts[businessId]?.username ?? '',
        apiKey: drafts[businessId]?.apiKey ?? '',
        fromNumber: drafts[businessId]?.fromNumber ?? '',
        ...patch
      }
    }));
  }

  function connectSmsProvider(businessId: string) {
    const draft = providerDrafts[businessId];
    if (!draft?.apiKey.trim()) {
      setBusinesses((current) => current.map((business) => business.id === businessId ? { ...business, smsSetupStatus: 'failed' } : business));
      setSmsNotice('Connection failed. Add the required provider credentials and try again.');
      return;
    }

    const cleanSender = draft.senderName.trim() || activeBusiness.sender;
    const preview = draft.apiKey.length <= 4 ? '••••' : `...${draft.apiKey.slice(-4)}`;

    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              messagingEnabled: true,
              smsProvider: draft.provider,
              smsSenderName: cleanSender,
              sender: cleanSender,
              smsSetupStatus: 'connected',
              maskedKeyPreview: preview
            }
          : business
      )
    );
    setProviderDrafts((drafts) => ({
      ...drafts,
      [businessId]: { provider: draft.provider, senderName: cleanSender, username: '', apiKey: '', fromNumber: '' }
    }));
    setSmsNotice(`${providerName(draft.provider)} connected. Full credentials are not shown after saving.`);
  }

  function disconnectSmsProvider(businessId: string) {
    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              messagingEnabled: false,
              smsProvider: null,
              smsSetupStatus: 'not_configured',
              maskedKeyPreview: undefined
            }
          : business
      )
    );
    setSmsNotice('SMS provider disconnected. Status changes will continue without customer messages.');
  }

  function testSmsProvider(businessId: string) {
    const draft = providerDrafts[businessId];
    if (!draft?.apiKey.trim()) {
      setBusinesses((current) => current.map((business) => business.id === businessId ? { ...business, smsSetupStatus: 'failed' } : business));
      setSmsNotice('Test failed. Paste the required provider credentials first.');
      return;
    }

    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              smsSetupStatus: business.messagingEnabled ? 'connected' : business.smsSetupStatus
            }
          : business
      )
    );
    setSmsNotice(`${providerName(draft.provider)} connection test passed. Save the provider to enable customer SMS.`);
  }

  function sendTestSms() {
    setSmsNotice(activeBusiness.messagingEnabled ? 'Test SMS queued through the organisation provider.' : 'SMS not configured. Connect ClickSend or Telnyx before sending a test.');
  }

  function updateJobStatus(jobId: string, status: JobStatus) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) return job;
        const message = smsTemplates[status]
          .replace('{{customer}}', job.customer.split(' ')[0])
          .replace('{{business}}', activeBusiness.name);

        return {
          ...job,
          status,
          updates: [{ status, at: 'Just now', sms: activeBusiness.messagingEnabled ? `Status updated. SMS preview ready: ${message}` : 'SMS not configured. Status updated, but no customer message was sent.' }, ...job.updates]
        };
      })
    );

    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const message = smsTemplates[status]
      .replace('{{customer}}', job.customer.split(' ')[0])
      .replace('{{business}}', activeBusiness.name);

    if (activeBusiness.messagingEnabled && activeBusiness.smsSetupStatus === 'connected') {
      setSmsNotice('');
      setSmsPreview({ jobId, customer: job.customer, phone: job.phone, status, message });
    } else {
      setSmsPreview(null);
      setSmsNotice('SMS not configured. Status updated, but no customer message was sent.');
    }
  }

  function sendPreviewSms() {
    if (!smsPreview) return;
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === smsPreview.jobId
          ? {
              ...job,
              updates: [{ status: smsPreview.status, at: 'Just now', sms: `Customer SMS sent via ${activeBusiness.smsProvider}: ${smsPreview.message}` }, ...job.updates]
            }
          : job
      )
    );
    setSmsPreview(null);
    setSmsNotice('Customer SMS sent using the organisation provider.');
  }

  async function copyPreviewSms() {
    if (!smsPreview) return;
    await navigator.clipboard?.writeText(smsPreview.message);
    setSmsNotice('Customer update copied. You can paste it into SMS, email, or chat for the demo.');
  }

  function addJob() {
    if (!newCustomer.trim() || !newPhone.trim()) {
      setSmsNotice('Add the customer name and mobile number before creating a job.');
      return;
    }

    const job: Job = {
      id: `J-${1051 + jobs.length}`,
      customer: newCustomer.trim(),
      phone: newPhone.trim(),
      item: newJobNotes.trim() ? newJobNotes.trim().split('\n')[0].slice(0, 80) : 'Customer job',
      serviceType: 'General service',
      priority: 'Standard',
      estimate: 'Not quoted',
      notes: newJobNotes.trim() || 'No special notes',
      status: 'collected',
      paid: false,
      due: 'Today',
      businessId: activeBusiness.id,
      updates: [
        {
          status: 'collected',
          at: 'Just now',
          sms: `Hi ${newCustomer.trim().split(' ')[0]}, ${activeBusiness.name} has received your order.`
        }
      ]
    };

    setJobs((currentJobs) => [job, ...currentJobs]);
    setSelectedJobId(job.id);
    setNewCustomer('');
    setNewPhone('');
    setNewJobNotes('');
    setSmsNotice('Job created. Move it through the workflow to preview customer updates.');
  }

  function addRosterShift() {
    if (!rosterStaff || !rosterDate.trim() || !rosterStart.trim() || !rosterEnd.trim() || !rosterArea.trim()) return;

    const staffRole = staffMembers.find((member) => member.name === rosterStaff)?.role ?? 'Staff';
    const shift: RosterShift = {
      id: `RS-${205 + rosterShifts.length}`,
      businessId: activeBusiness.id,
      staffName: rosterStaff,
      role: staffRole,
      date: rosterDate.trim(),
      start: rosterStart.trim(),
      end: rosterEnd.trim(),
      area: rosterArea.trim(),
      response: 'sent'
    };

    setRosterShifts((current) => [shift, ...current]);
    setSmsNotice(`Shift sent to ${shift.staffName} for ${formatRosterDate(shift.date)}, ${shift.start} to ${shift.end}.`);
  }

  function updateRosterResponse(shiftId: string, response: ShiftResponse) {
    setRosterShifts((current) => current.map((shift) => (shift.id === shiftId ? { ...shift, response } : shift)));
    setSmsNotice(response === 'accepted' ? 'Shift accepted.' : response === 'declined' ? 'Shift declined.' : 'Roster updated.');
  }

  function deleteRosterShift(shiftId: string) {
    const shift = rosterShifts.find((item) => item.id === shiftId);
    setRosterShifts((current) => current.filter((item) => item.id !== shiftId));
    setSmsNotice(shift ? `Deleted ${shift.staffName}'s shift for ${formatRosterDate(shift.date)}.` : 'Shift deleted.');
  }

  function addJobNote(jobId: string, note: string) {
    const trimmed = note.trim();
    if (!trimmed) return;

    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              notes: job.notes === 'No special notes' ? trimmed : `${job.notes}\n${trimmed}`,
              updates: [{ at: 'Just now', sms: trimmed, kind: 'note' }, ...job.updates]
            }
          : job
      )
    );
  }

  function toggleJobPaid(jobId: string) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              paid: !job.paid,
              paidAt: job.paid ? undefined : 'Just now',
              updates: [
                {
                  at: 'Just now',
                  kind: 'payment',
                  sms: job.paid ? 'Payment marked as unpaid.' : 'Payment marked as paid.'
                },
                ...job.updates
              ]
            }
          : job
      )
    );
  }

  function toggleStaffClock(name: string) {
    setStaffMembers((members) =>
      members.map((member) =>
        member.name === name
          ? {
              ...member,
              clockedIn: !member.clockedIn,
              clockInAt: member.clockedIn ? undefined : 'Just now',
              hoursToday: member.clockedIn ? Math.max(member.hoursToday, 6.4) : member.hoursToday
            }
          : member
      )
    );
  }

  if (activeInviteToken) {
    return (
      <BrandProvider brand={brandFromBusiness(inviteBusiness)}>
        <InviteAcceptView
          invite={activeInvite}
          setupDraft={setupDraft}
          setSetupDraft={setSetupDraft}
          completeInviteSetup={completeInviteSetup}
        />
      </BrandProvider>
    );
  }

  if (customerTrackJobId) {
    return (
      <BrandProvider brand={brandFromBusiness(customerTrackBusiness)}>
        <CustomerStatusView job={customerTrackJob} business={customerTrackBusiness} />
      </BrandProvider>
    );
  }

  if (!authUser && isOverviewPath) {
    return (
      <BrandProvider brand={platformBrand}>
        <ProductOverviewView />
      </BrandProvider>
    );
  }

  if (!authReady && !activeInviteToken && !customerTrackJobId) {
    return (
      <BrandProvider brand={authUser ? activeBrand : loginBrand}>
        <LoadingScreen message="Restoring your session" />
      </BrandProvider>
    );
  }

  if (!authUser) {
    return (
      <BrandProvider brand={loginBrand}>
        <LoginView
          role={loginRole}
          setRole={setLoginRole}
          email={loginEmail}
          setEmail={setLoginEmail}
          password={loginPassword}
          setPassword={setLoginPassword}
          error={loginError}
          login={login}
        />
      </BrandProvider>
    );
  }

  return (
    <BrandProvider brand={activeBrand}>
    <div className="app-shell" style={{ '--brand': activeBrand.primary, '--accent': activeBrand.accent } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <BusinessLogo business={activeBusiness} className="nav-logo" />
          <div>
            <strong>{activeBrand.name}</strong>
            <span>Powered by {activeBrand.poweredBy}</span>
          </div>
        </div>

        <nav className="portal-switcher" aria-label="Portal">
          {visiblePortals.map((key) => {
            const Icon = portalMeta[key].icon;
            return (
              <button key={key} className={portal === key ? 'active' : ''} onClick={() => openPortal(key)}>
                <Icon size={18} />
                <span>{portalMeta[key].label}</span>
              </button>
            );
          })}
        </nav>

        <div className="tenant-card">
          <div className="tenant-card-top">
            <BusinessLogo business={activeBusiness} className="tenant-logo" />
            <div className="tenant-shield" aria-hidden="true">
              <ShieldCheck size={21} />
            </div>
          </div>
          <span className="eyebrow">Active tenant</span>
          <strong>{activeBusiness.name}</strong>
          <p>{activeBusiness.industry} · {activeBusiness.location}</p>
          <div className="brand-palette">
            <span style={{ background: activeBusiness.primary }} />
            <span style={{ background: activeBusiness.accent }} />
            <small>{activeBusiness.sender}</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">{portalMeta[portal].label}</span>
            <h1>{portal === 'super' ? 'Platform command centre' : activeBusiness.name}</h1>
            {portal === 'super' ? (
              <p>Manage tenants, branding, invites, and platform readiness.</p>
            ) : (
              <p>{activeBusiness.industry} · {activeBusiness.location}</p>
            )}
          </div>
          <div className="topbar-actions">
            <span className={hasAppwriteConfig ? 'config-pill ready' : 'config-pill'}>
              <LockKeyhole size={15} />
              {hasAppwriteConfig ? 'Appwrite connected' : 'Demo mode'}
            </span>
            <button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications((open) => !open)}>
              <Bell size={19} />
            </button>
            <button className="logout-button" onClick={logout}>
              <LogOut size={16} />
              Sign out
            </button>
            {showNotifications && (
              <div className="notification-menu">
                <strong>Notifications</strong>
                <p>{smsNotice || 'No urgent alerts. Workflow, shifts, and messaging are up to date.'}</p>
                <button onClick={() => setShowNotifications(false)}>Mark all read</button>
              </div>
            )}
          </div>
        </header>

        {portal === 'super' && (
          <SuperAdminView
            businesses={businesses}
            businessesLoading={businessesLoading}
            activeBusinessId={activeBusinessId}
            onBusinessChange={setActiveBusinessId}
            activeBusiness={activeBusiness}
            newBusinessName={newBusinessName}
            setNewBusinessName={setNewBusinessName}
            newBusinessContactName={newBusinessContactName}
            setNewBusinessContactName={setNewBusinessContactName}
            newBusinessIndustry={newBusinessIndustry}
            setNewBusinessIndustry={setNewBusinessIndustry}
            newBusinessLocation={newBusinessLocation}
            setNewBusinessLocation={setNewBusinessLocation}
            newBusinessPhone={newBusinessPhone}
            setNewBusinessPhone={setNewBusinessPhone}
            newBusinessAdminEmail={newBusinessAdminEmail}
            setNewBusinessAdminEmail={setNewBusinessAdminEmail}
            organisationInvites={organisationInvites}
            copiedInviteId={copiedInviteId}
            inviteSendingId={inviteSendingId}
            inviteNotice={inviteNotice}
            copyInviteLink={copyInviteLink}
            sendInviteEmail={sendInviteEmail}
            addBusiness={addBusiness}
            deleteBusiness={deleteBusiness}
            uploadBusinessLogo={uploadBusinessLogo}
            removeBusinessLogo={removeBusinessLogo}
            updateBusinessBrand={updateBusinessBrand}
            resetDemoData={resetDemoData}
          />
        )}

        {portal === 'admin' && (
          <BusinessAdminView
            business={activeBusiness}
            jobs={visibleJobs}
            staff={staffMembers}
            rosterShifts={activeRosterShifts}
            rosterDraft={{ staffName: rosterStaff, date: rosterDate, start: rosterStart, end: rosterEnd, area: rosterArea }}
            setRosterDraft={(patch) => {
              if (patch.staffName !== undefined) setRosterStaff(patch.staffName);
              if (patch.date !== undefined) setRosterDate(patch.date);
              if (patch.start !== undefined) setRosterStart(patch.start);
              if (patch.end !== undefined) setRosterEnd(patch.end);
              if (patch.area !== undefined) setRosterArea(patch.area);
            }}
            addRosterShift={addRosterShift}
            deleteRosterShift={deleteRosterShift}
            query={query}
            setQuery={setQuery}
            selectedJob={selectedJob}
            setSelectedJobId={setSelectedJobId}
            updateJobStatus={updateJobStatus}
            addJobNote={addJobNote}
            toggleJobPaid={toggleJobPaid}
            workflowStages={workflowStages}
            setWorkflowStage={(status, patch) => setWorkflowStages((stages) => ({ ...stages, [status]: { ...stages[status], ...patch } }))}
            smsNotice={smsNotice}
            providerDraft={getProviderDraft(activeBusiness)}
            updateProviderDraft={(patch) => updateProviderDraft(activeBusiness.id, patch)}
            connectSmsProvider={() => connectSmsProvider(activeBusiness.id)}
            disconnectSmsProvider={() => disconnectSmsProvider(activeBusiness.id)}
            testSmsProvider={() => testSmsProvider(activeBusiness.id)}
            sendTestSms={sendTestSms}
            smsTemplates={smsTemplates}
            setSmsTemplate={(status, body) => setSmsTemplates((templates) => ({ ...templates, [status]: body }))}
            newCustomer={newCustomer}
            setNewCustomer={setNewCustomer}
            newPhone={newPhone}
            setNewPhone={setNewPhone}
            newJobNotes={newJobNotes}
            setNewJobNotes={setNewJobNotes}
            addJob={addJob}
          />
        )}

        {portal === 'staff' && (
          <StaffView
            jobs={visibleJobs}
            selectedJob={selectedJob}
            setSelectedJobId={setSelectedJobId}
            addJobNote={addJobNote}
            toggleJobPaid={toggleJobPaid}
            workflowStages={workflowStages}
            query={query}
            setQuery={setQuery}
            staffMember={staffMembers[2]}
            rosterShifts={activeRosterShifts.filter((shift) => shift.staffName === staffMembers[2].name)}
            updateRosterResponse={updateRosterResponse}
            toggleClock={() => toggleStaffClock(staffMembers[2].name)}
          />
        )}
        {smsPreview && (
          <SmsPreviewModal preview={smsPreview} provider={activeBusiness.smsProvider} onSend={sendPreviewSms} onCopy={copyPreviewSms} onClose={() => setSmsPreview(null)} />
        )}
      </main>
    </div>
    </BrandProvider>
  );
}

function SuperAdminView({
  businesses: tenants,
  businessesLoading,
  activeBusinessId,
  onBusinessChange,
  activeBusiness,
  newBusinessName,
  setNewBusinessName,
  newBusinessContactName,
  setNewBusinessContactName,
  newBusinessIndustry,
  setNewBusinessIndustry,
  newBusinessLocation,
  setNewBusinessLocation,
  newBusinessPhone,
  setNewBusinessPhone,
  newBusinessAdminEmail,
  setNewBusinessAdminEmail,
  organisationInvites,
  copiedInviteId,
  inviteSendingId,
  inviteNotice,
  copyInviteLink,
  sendInviteEmail,
  addBusiness,
  deleteBusiness,
  uploadBusinessLogo,
  removeBusinessLogo,
  updateBusinessBrand,
  resetDemoData
}: {
  businesses: Business[];
  businessesLoading: boolean;
  activeBusinessId: string;
  onBusinessChange: (businessId: string) => void;
  activeBusiness: Business;
  newBusinessName: string;
  setNewBusinessName: (value: string) => void;
  newBusinessContactName: string;
  setNewBusinessContactName: (value: string) => void;
  newBusinessIndustry: string;
  setNewBusinessIndustry: (value: string) => void;
  newBusinessLocation: string;
  setNewBusinessLocation: (value: string) => void;
  newBusinessPhone: string;
  setNewBusinessPhone: (value: string) => void;
  newBusinessAdminEmail: string;
  setNewBusinessAdminEmail: (value: string) => void;
  organisationInvites: OrganisationInvite[];
  copiedInviteId: string;
  inviteSendingId: string;
  inviteNotice: string;
  copyInviteLink: (inviteId: string) => void;
  sendInviteEmail: (inviteId: string) => void;
  addBusiness: () => void | Promise<void>;
  deleteBusiness: (businessId: string) => void;
  uploadBusinessLogo: (businessId: string, file?: File) => void;
  removeBusinessLogo: (businessId: string) => void;
  updateBusinessBrand: (businessId: string, patch: Partial<Pick<Business, 'primary' | 'accent'>>) => void;
  resetDemoData: () => void;
}) {
  const activeTenants = tenants.filter((tenant) => tenant.active).length;
  const connectedMessagingTenants = tenants.filter((tenant) => tenant.messagingEnabled).length;

  return (
    <div className="view-grid super-admin-view">
      <section className="metric-grid super-metrics">
        <Metric icon={Building2} label="Organisations" value={tenants.length.toString()} detail={`${activeTenants} enabled`} />
        <Metric icon={MessageSquareText} label="BYO providers" value={`${connectedMessagingTenants}/${tenants.length}`} detail="Businesses connected" />
        <Metric icon={CreditCard} label="MRR" value="$7.4k" detail="Subscriptions healthy" />
        <Metric icon={Activity} label="Jobs today" value={tenants.reduce((sum, tenant) => sum + tenant.jobs, 0).toString()} detail="Live workflow volume" />
      </section>

      <section className="panel wide super-business-panel">
        <PanelHeader icon={Building2} title="Businesses" action={businessesLoading ? 'Syncing Appwrite' : 'Create, brand, invite'} />
        <div className="business-create-form">
          <input value={newBusinessName} onChange={(event) => setNewBusinessName(event.target.value)} placeholder="Business name" />
          <input value={newBusinessContactName} onChange={(event) => setNewBusinessContactName(event.target.value)} placeholder="Contact name" />
          <input value={newBusinessIndustry} onChange={(event) => setNewBusinessIndustry(event.target.value)} placeholder="Industry" />
          <input value={newBusinessLocation} onChange={(event) => setNewBusinessLocation(event.target.value)} placeholder="Location" />
          <input value={newBusinessPhone} onChange={(event) => setNewBusinessPhone(event.target.value)} placeholder="Phone" />
          <input value={newBusinessAdminEmail} onChange={(event) => setNewBusinessAdminEmail(event.target.value)} placeholder="Admin email invite" type="email" />
          <button onClick={addBusiness} disabled={!newBusinessName.trim() || !newBusinessAdminEmail.trim()}>
            <Plus size={17} />
            Send invite
          </button>
        </div>
        <div className="tenant-list premium-tenant-list">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className={`tenant-row ${activeBusinessId === tenant.id ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onBusinessChange(tenant.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onBusinessChange(tenant.id);
              }}
            >
              <BusinessLogo business={tenant} className="tenant-row-logo" />
              <div className="tenant-row-main">
                <strong>{tenant.name}</strong>
                <span>{tenant.industry} · {tenant.location}</span>
                <small>{tenant.adminEmail || 'Admin invite not sent'}</small>
              </div>
              <div className="tenant-actions">
                <div className="tenant-meta">
                  <span>{tenant.plan}</span>
                  <span className={tenant.active ? 'status-dot active' : 'status-dot paused'}>
                    {tenant.active ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <details className="tenant-menu" onClick={(event) => event.stopPropagation()}>
                  <summary aria-label={`Actions for ${tenant.name}`}>•••</summary>
                  <button
                    disabled={tenants.length <= 1}
                    onClick={() => deleteBusiness(tenant.id)}
                  >
                    Delete business
                  </button>
                </details>
              </div>
              <ChevronRight size={18} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel super-invite-panel">
        <PanelHeader icon={Mail} title="Company Invites" action={`${organisationInvites.filter((invite) => inviteStatus(invite) === 'pending').length} pending`} />
        {inviteNotice && <div className="inline-notice">{inviteNotice}</div>}
        <div className="invite-list">
          {organisationInvites.map((invite) => (
            <div className="invite-row" key={invite.id}>
              <div>
                <strong>{invite.businessName}</strong>
                <span>{invite.contactName} · {invite.adminEmail}</span>
                <span>Expires {formatRelativeDate(invite.expiresAt)}</span>
              </div>
              <div className="invite-actions">
                <span className={inviteStatus(invite) === 'accepted' ? 'status-dot active' : inviteStatus(invite) === 'expired' ? 'status-dot paused' : 'status-dot pending'}>{inviteStatus(invite)}</span>
                {appwriteInviteFunctionId ? (
                  <button onClick={() => sendInviteEmail(invite.id)} disabled={inviteSendingId === invite.id || inviteStatus(invite) !== 'pending'}>
                    {inviteSendingId === invite.id ? 'Sending' : invite.sentAt.includes('sent') ? 'Resend email' : 'Send email'}
                  </button>
                ) : (
                  <a className="secondary-action compact-action" href={inviteMailtoHref(invite)}>
                    Open email
                  </a>
                )}
                <a className="secondary-action compact-action" href={buildInviteUrl(invite)} target="_blank" rel="noreferrer">Preview</a>
                <button onClick={() => copyInviteLink(invite.id)}>{copiedInviteId === invite.id ? 'Copied' : 'Copy invite'}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel spotlight-panel">
        <PanelHeader icon={Paintbrush} title="Business Branding" action="One logo powers the portal" />
        <p className="panel-intro">Upload the main business logo once. Verola reuses it for login, setup links, dashboards, customer tracking, email headers, and app icons where supported.</p>
        <div className="branding-preview" style={{ '--brand': activeBusiness.primary, '--accent': activeBusiness.accent } as React.CSSProperties}>
          <BusinessLogo business={activeBusiness} className="preview-logo" />
          <div>
            <span className="eyebrow">Login preview</span>
            <strong>{activeBusiness.name}</strong>
            <p>{activeBusiness.industry} dashboard · Powered by Verola</p>
          </div>
          <button>Primary action</button>
        </div>
        <div className="branding-header-preview" style={{ '--brand': activeBusiness.primary, '--accent': activeBusiness.accent } as React.CSSProperties}>
          <div>
            <span className="eyebrow">Dashboard header preview</span>
            <strong>{activeBusiness.name}</strong>
            <p>{activeBusiness.industry} · {activeBusiness.location}</p>
          </div>
          <ShieldCheck size={24} />
        </div>
        <div className="brand-command">
          <BusinessLogo business={activeBusiness} className="super-logo" />
          <div>
            <strong>{activeBusiness.name}</strong>
            <p>{activeBusiness.logoName ? `Main logo: ${activeBusiness.logoName}` : 'No custom logo yet. Platform fallback is active.'}</p>
          </div>
        </div>
        <div className="brand-actions">
          <label className="logo-upload">
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(event) => uploadBusinessLogo(activeBusiness.id, event.target.files?.[0])} />
            <Paintbrush size={17} />
            {activeBusiness.logoUrl ? 'Replace logo' : 'Upload logo'}
          </label>
          <button className="secondary-action" onClick={() => removeBusinessLogo(activeBusiness.id)} disabled={!activeBusiness.logoUrl}>
            <X size={16} />
            Remove logo
          </button>
        </div>
        <div className="brand-colour-controls">
          <label>
            <span>Optional brand colour</span>
            <input type="color" value={activeBusiness.primary} onChange={(event) => updateBusinessBrand(activeBusiness.id, { primary: event.target.value })} />
          </label>
          <label>
            <span>Accent colour</span>
            <input type="color" value={activeBusiness.accent} onChange={(event) => updateBusinessBrand(activeBusiness.id, { accent: event.target.value })} />
          </label>
        </div>
        <div className="brand-surface-list">
          {['Login', 'Invite setup', 'Dashboard', 'Mobile header', 'Customer status', 'Email header', 'App icon', 'Favicon'].map((surface) => (
            <span key={surface}><Check size={14} />{surface}</span>
          ))}
        </div>
        <div className="settings-stack">
          <Setting label="Main logo" value={activeBusiness.logoUrl ? 'Used across tenant experience' : 'Platform fallback logo'} />
          <Setting label="Optional overrides" value="App icon, favicon, dark/light logo, email header" />
          <Setting label="Current brand colour" value={activeBusiness.primary || 'Platform default'} />
          <Setting label="Tenant isolation" value="Branding loads from organisation context" />
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={ShieldCheck} title="BYO Messaging Policy" />
        <div className="settings-stack">
          <Setting label="Platform SMS account" value="Not used" />
          <Setting label="Supported providers" value="ClickSend, Telnyx" />
          <Setting label="SMS costs" value="Paid directly by each business" />
          <Setting label="Credentials" value="Encrypted server-side only" />
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Activity} title="Demo Activity" action="Last updated just now" />
        <div className="activity-list">
          <div><strong>Fresh Fold Laundry</strong><span>3 jobs moving through pickup workflow</span></div>
          <div><strong>Rapid Auto Care</strong><span>Inspection update ready to preview</span></div>
          <div><strong>Paws & Polish</strong><span>Customer pickup notification sent</span></div>
          <div><strong>Demo reset</strong><span>Restore sample data before a client meeting</span></div>
        </div>
        <button className="secondary-action full-width" onClick={resetDemoData}>Reset demo data</button>
      </section>
    </div>
  );
}

function LoginView({
  role,
  setRole,
  email,
  setEmail,
  password,
  setPassword,
  error,
  login
}: {
  role: UserRole;
  setRole: (role: UserRole) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  login: () => void;
}) {
  const brand = useBranding();
  return (
    <main className="login-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <BrandMark className="login-logo" />
          <div>
            <strong>{brand.name}</strong>
            <span>{brand.name === 'Verola' ? 'Secure tenant login' : `Powered by ${brand.poweredBy}`}</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">Sign in</span>
          <h1>{portalMeta[role].label}</h1>
          <p className="login-copy">Choose the dashboard assigned to your account. Business and staff users only see their own organisation.</p>
        </div>
        <div className="role-tabs">
          {(Object.keys(portalMeta) as UserRole[]).map((key) => {
            const Icon = portalMeta[key].icon;
            return (
              <button
                key={key}
                className={role === key ? 'active' : ''}
                onClick={() => {
                  setRole(key);
                  setEmail(demoEmailByRole[key]);
                }}
              >
                <Icon size={17} />
                {portalMeta[key].label}
              </button>
            );
          })}
        </div>
        <div className="login-form">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" onKeyDown={(event) => event.key === 'Enter' && login()} />
          <button className="primary-action" onClick={login}>
            <LogIn size={18} />
            Sign in
          </button>
        </div>
        {error && <p className="login-error">{error}</p>}
        <div className="login-help">
          <strong>Demo assigned users</strong>
          <span>Super Admin: platform owner email</span>
          <span>Business Admin: owner@freshfold.test</span>
          <span>Staff: mia@freshfold.test</span>
        </div>
        <a className="login-link" href="/overview">View product overview</a>
      </section>
    </main>
  );
}

function ProductOverviewView() {
  return (
    <main className="overview-screen">
      <section className="overview-hero">
        <div className="brand-lockup">
          <BrandMark className="login-logo" />
          <div>
            <strong>Verola</strong>
            <span>White-label workflow updates for service businesses</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">Client-ready SaaS demo</span>
          <h1>Track every customer job and keep people updated automatically.</h1>
          <p>Verola gives small service businesses a branded portal for drop-offs, job progress, staff handover, rosters, payments, and customer SMS updates.</p>
        </div>
        <div className="overview-actions">
          <a className="primary-action" href="/login">Open demo login</a>
          <a className="secondary-action" href="/super-admin">Super Admin portal</a>
        </div>
      </section>
      <section className="overview-grid">
        {demoHighlights.map((highlight) => (
          <article className="overview-card" key={highlight}>
            <CheckCircle2 size={20} />
            <p>{highlight}</p>
          </article>
        ))}
      </section>
      <section className="overview-demo-strip">
        <div><strong>Laundromat</strong><span>Order ready for pickup</span></div>
        <div><strong>Mechanic</strong><span>Vehicle inspection update</span></div>
        <div><strong>Pet groomer</strong><span>Pickup notification</span></div>
        <div><strong>Beauty clinic</strong><span>Appointment reminder</span></div>
      </section>
    </main>
  );
}

function InviteAcceptView({
  invite,
  setupDraft,
  setSetupDraft,
  completeInviteSetup
}: {
  invite?: OrganisationInvite;
  setupDraft: SetupDraft;
  setSetupDraft: (draft: SetupDraft | ((current: SetupDraft) => SetupDraft)) => void;
  completeInviteSetup: (token: string) => void;
}) {
  const brand = useBranding();
  const status = invite ? inviteStatus(invite) : undefined;
  const unavailableTitle = status === 'accepted' ? 'Invite already used' : status === 'expired' ? 'Invite expired' : 'Link unavailable';
  const unavailableCopy = status === 'accepted'
    ? 'This setup link has already been accepted. Sign in with the business admin account instead.'
    : status === 'expired'
      ? 'This setup link has expired. Ask the platform owner to send a new invite.'
      : 'This invite token is invalid or could not be found.';

  return (
    <main className="login-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <BrandMark className="login-logo" />
          <div>
            <strong>{brand.name}</strong>
            <span>Company setup invite · Powered by {brand.poweredBy}</span>
          </div>
        </div>
        {invite && status === 'pending' ? (
          <>
            <div>
              <span className="eyebrow">Business Setup</span>
              <h1>{invite.businessName}</h1>
              <p className="login-copy">Verola has prepared a branded workspace for your business. Confirm the details, create your admin login, and your dashboard will open ready to use.</p>
            </div>
            <div className="login-help">
              <strong>Invite verified</strong>
              <span>Dashboard: Business Admin</span>
              <span>Organisation: {invite.businessName}</span>
              <span>Email: {invite.adminEmail}</span>
              <span>Invite source: Verola</span>
              <span>Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span>
            </div>
            <div className="login-form">
              <input value={invite.businessName} readOnly aria-label="Business name" />
              <input value={setupDraft.name} onChange={(event) => setSetupDraft((current) => ({ ...current, name: event.target.value, error: '' }))} placeholder="Your name" />
              <input value={setupDraft.password} onChange={(event) => setSetupDraft((current) => ({ ...current, password: event.target.value, error: '' }))} placeholder="Create password" type="password" />
            </div>
            {setupDraft.error && <p className="login-error">{setupDraft.error}</p>}
            <button className="primary-action" onClick={() => completeInviteSetup(invite.token)}>
              <CheckCircle2 size={18} />
              Complete setup
            </button>
            <a className="login-link" href="/login">Back to login</a>
          </>
        ) : (
          <>
            <div>
              <span className="eyebrow">Invite not found</span>
              <h1>{unavailableTitle}</h1>
              <p className="login-copy">{unavailableCopy}</p>
            </div>
            <a className="login-link" href="/login">Back to login</a>
          </>
        )}
      </section>
    </main>
  );
}

function CustomerStatusView({ job, business }: { job?: Job; business?: Business }) {
  const brand = useBranding();

  return (
    <main className="login-screen customer-status-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="login-panel customer-status-card">
        <div className="brand-lockup login-brand">
          <BrandMark className="login-logo" />
          <div>
            <strong>{brand.name}</strong>
            <span>{business ? `${business.industry} updates` : 'Customer update'}</span>
          </div>
        </div>
        {job && business ? (
          <>
            <div>
              <span className="eyebrow">Job status</span>
              <h1>{job.customer}</h1>
              <p className="login-copy">{job.item}</p>
            </div>
            <div className="login-help">
              <strong>{business.name}</strong>
              <span>Status: {defaultWorkflowStages[job.status].label}</span>
              <span>Payment: {job.paid ? 'Paid' : 'Not paid yet'}</span>
              <span>Due: {job.due}</span>
            </div>
            <p className="powered-by">Powered by {brand.poweredBy}</p>
          </>
        ) : (
          <>
            <div>
              <span className="eyebrow">Status unavailable</span>
              <h1>Tracking link not found</h1>
              <p className="login-copy">Check the link or contact the business for an update.</p>
            </div>
            <p className="powered-by">Powered by {brand.poweredBy}</p>
          </>
        )}
      </section>
    </main>
  );
}

function LoadingScreen({ message }: { message: string }) {
  const brand = useBranding();
  return (
    <main className="loading-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="loading-card">
        <BrandMark className="login-logo" />
        <div>
          <strong>{brand.name}</strong>
          <span>{message}</span>
        </div>
      </section>
    </main>
  );
}

function BusinessAdminView(props: {
  business: Business;
  jobs: Job[];
  staff: StaffMember[];
  rosterShifts: RosterShift[];
  rosterDraft: { staffName: string; date: string; start: string; end: string; area: string };
  setRosterDraft: (patch: Partial<{ staffName: string; date: string; start: string; end: string; area: string }>) => void;
  addRosterShift: () => void;
  deleteRosterShift: (shiftId: string) => void;
  query: string;
  setQuery: (query: string) => void;
  selectedJob?: Job;
  setSelectedJobId: (id: string) => void;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  addJobNote: (jobId: string, note: string) => void;
  toggleJobPaid: (jobId: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  setWorkflowStage: (status: JobStatus, patch: Partial<WorkflowStage>) => void;
  smsNotice: string;
  providerDraft: { provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string };
  updateProviderDraft: (patch: Partial<{ provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string }>) => void;
  connectSmsProvider: () => void;
  disconnectSmsProvider: () => void;
  testSmsProvider: () => void;
  sendTestSms: () => void;
  smsTemplates: Record<JobStatus, string>;
  setSmsTemplate: (status: JobStatus, body: string) => void;
  newCustomer: string;
  setNewCustomer: (value: string) => void;
  newPhone: string;
  setNewPhone: (value: string) => void;
  newJobNotes: string;
  setNewJobNotes: (value: string) => void;
  addJob: () => void;
}) {
  const readyJobs = props.jobs.filter((job) => job.status === 'ready_for_pickup').length;
  const openJobs = props.jobs.filter((job) => job.status !== 'completed').length;
  const unpaidJobs = props.jobs.filter((job) => !job.paid).length;
  const pendingRosterReplies = props.rosterShifts.filter((shift) => shift.response === 'sent').length;

  return (
    <div className="business-admin-layout">
      <section className="business-command">
        <div>
          <span className="eyebrow">Today</span>
          <h2>Run the floor from one place</h2>
          <p>Add a customer, move work through the queue, and preview updates before customers are contacted.</p>
        </div>
        <div className="command-stats">
          <div><strong>{openJobs}</strong><span>Open</span></div>
          <div><strong>{readyJobs}</strong><span>Ready</span></div>
          <div><strong>{unpaidJobs}</strong><span>Unpaid</span></div>
          <div><strong>{pendingRosterReplies}</strong><span>Roster replies</span></div>
        </div>
      </section>

      <section className="panel create-job admin-primary-panel">
        <PanelHeader icon={Plus} title="Add customer job" action="Name, mobile, notes" />
        <div className="quick-form">
          <input value={props.newCustomer} onChange={(event) => props.setNewCustomer(event.target.value)} placeholder="Customer name" />
          <input value={props.newPhone} onChange={(event) => props.setNewPhone(event.target.value)} placeholder="Mobile number" />
          <textarea value={props.newJobNotes} onChange={(event) => props.setNewJobNotes(event.target.value)} placeholder="Notes, job details, item, preferences..." rows={2} />
          <button className="primary-action" onClick={props.addJob} disabled={!props.newCustomer.trim() || !props.newPhone.trim()}>
            <Plus size={18} />
            Add job
          </button>
        </div>
      </section>

      <section className="panel workflow-panel">
        <JobsHeader query={props.query} setQuery={props.setQuery} />
        <div className="workflow-layout">
          <WorkflowBoard jobs={props.jobs} selectedJobId={props.selectedJob?.id} setSelectedJobId={props.setSelectedJobId} workflowStages={props.workflowStages} />
          <JobDetail job={props.selectedJob} updateJobStatus={props.updateJobStatus} addJobNote={props.addJobNote} toggleJobPaid={props.toggleJobPaid} workflowStages={props.workflowStages} />
        </div>
      </section>

      <section className="admin-secondary-grid">
        <details className="panel admin-drawer" open>
          <summary><CalendarPlus size={18} /> Rostering <span>{pendingRosterReplies} pending</span></summary>
          <RosterPlanner
            staff={props.staff}
            shifts={props.rosterShifts}
            draft={props.rosterDraft}
            setDraft={props.setRosterDraft}
            addShift={props.addRosterShift}
            deleteShift={props.deleteRosterShift}
          />
        </details>

        <details className="panel admin-drawer">
          <summary><MessageSquareText size={18} /> Messaging <span>{props.business.smsSetupStatus === 'connected' ? 'Connected' : 'Not configured'}</span></summary>
          <MessagingSettings
            business={props.business}
            draft={props.providerDraft}
            updateDraft={props.updateProviderDraft}
            connectProvider={props.connectSmsProvider}
            disconnectProvider={props.disconnectSmsProvider}
            testProvider={props.testSmsProvider}
            sendTestSms={props.sendTestSms}
            notice={props.smsNotice}
          />
          <SmsTemplateEditor templates={props.smsTemplates} setTemplate={props.setSmsTemplate} workflowStages={props.workflowStages} />
        </details>

        <details className="panel admin-drawer">
          <summary><Settings size={18} /> Workflow stages <span>Custom labels</span></summary>
          <WorkflowStageEditor stages={props.workflowStages} setStage={props.setWorkflowStage} />
        </details>

        <details className="panel admin-drawer">
          <summary><Users size={18} /> Staff and shifts <span>{props.staff.length} users</span></summary>
          <div className="admin-staff-grid">
            <div className="staff-list">
              {props.staff.map((member) => (
                <div className="staff-row" key={member.phone}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.role} · {member.phone}</span>
                  </div>
                  <span className={member.active ? 'status-dot active' : 'status-dot paused'}>{member.active ? 'Active' : 'Paused'}</span>
                </div>
              ))}
            </div>
            <div className="shift-list">
              {props.staff.map((member) => (
                <div className="shift-row" key={member.phone}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.clockedIn ? `Clocked in ${member.clockInAt}` : `Last shift ${member.lastShift}`}</span>
                  </div>
                  <div className="shift-hours">
                    <strong>{member.hoursToday.toFixed(1)}h</strong>
                    <span className={member.clockedIn ? 'status-dot active' : 'status-dot paused'}>{member.clockedIn ? 'On shift' : 'Off shift'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}

function StaffView(props: {
  jobs: Job[];
  selectedJob?: Job;
  setSelectedJobId: (id: string) => void;
  addJobNote: (jobId: string, note: string) => void;
  toggleJobPaid: (jobId: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  query: string;
  setQuery: (query: string) => void;
  staffMember: StaffMember;
  rosterShifts: RosterShift[];
  updateRosterResponse: (shiftId: string, response: ShiftResponse) => void;
  toggleClock: () => void;
}) {
  return (
    <div className="staff-layout">
      <section className="shift-hero">
        <div>
          <span className="eyebrow">Shift clock</span>
          <h2>{props.staffMember.clockedIn ? 'You are clocked in' : 'Ready to start your shift?'}</h2>
          <p>{props.staffMember.clockedIn ? `Started ${props.staffMember.clockInAt} · ${props.staffMember.hoursToday.toFixed(1)}h today` : `Last shift ${props.staffMember.lastShift}`}</p>
        </div>
        <button className={props.staffMember.clockedIn ? 'clock-action clock-out' : 'clock-action'} onClick={props.toggleClock}>
          {props.staffMember.clockedIn ? <LogOut size={20} /> : <LogIn size={20} />}
          {props.staffMember.clockedIn ? 'Clock out' : 'Clock in'}
        </button>
      </section>
      <section className="panel wide">
        <JobsHeader query={props.query} setQuery={props.setQuery} />
        <div className="workflow-layout staff-workbench">
          <WorkflowBoard jobs={props.jobs} selectedJobId={props.selectedJob?.id} setSelectedJobId={props.setSelectedJobId} workflowStages={props.workflowStages} compact />
          <JobDetail job={props.selectedJob} addJobNote={props.addJobNote} toggleJobPaid={props.toggleJobPaid} workflowStages={props.workflowStages} compact />
        </div>
      </section>
      <section className="panel wide">
        <PanelHeader icon={CalendarPlus} title="My shifts" action={`${props.rosterShifts.filter((shift) => shift.response === 'sent').length} to reply`} />
        <StaffRoster shifts={props.rosterShifts} updateRosterResponse={props.updateRosterResponse} />
      </section>
    </div>
  );
}

function JobsHeader({ query, setQuery }: { query: string; setQuery: (query: string) => void }) {
  return (
    <div className="jobs-header">
      <PanelHeader icon={History} title="Customer Jobs" />
      <label className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, item" />
      </label>
    </div>
  );
}

function RosterPlanner({
  staff,
  shifts,
  draft,
  setDraft,
  addShift,
  deleteShift
}: {
  staff: StaffMember[];
  shifts: RosterShift[];
  draft: { staffName: string; date: string; start: string; end: string; area: string };
  setDraft: (patch: Partial<{ staffName: string; date: string; start: string; end: string; area: string }>) => void;
  addShift: () => void;
  deleteShift: (shiftId: string) => void;
}) {
  const calendarDays = buildRosterCalendar(draft.date);
  const visibleMonth = rosterMonthLabel(draft.date);
  const shiftsByDate = shifts.reduce<Record<string, RosterShift[]>>((groups, shift) => {
    groups[shift.date] = [...(groups[shift.date] ?? []), shift].sort((a, b) => a.start.localeCompare(b.start));
    return groups;
  }, {});
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const presets = [
    { label: 'Morning', start: '7:00 AM', end: '1:00 PM', area: 'Opening shift' },
    { label: 'Day', start: '9:00 AM', end: '5:00 PM', area: 'Front counter' },
    { label: 'Late', start: '1:00 PM', end: '7:00 PM', area: 'Pickup counter' }
  ];

  return (
    <div className="roster-planner">
      <div className="roster-toolbar">
        <div>
          <strong>Schedule any date in the year</strong>
          <p>Pick a date, use a preset, send it to staff, then track accept and decline replies.</p>
        </div>
        <div className="roster-presets">
          {presets.map((preset) => (
            <button key={preset.label} onClick={() => setDraft({ start: preset.start, end: preset.end, area: preset.area })}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="roster-form">
        <label>
          <span>Staff</span>
          <select value={draft.staffName} onChange={(event) => setDraft({ staffName: event.target.value })}>
            {staff.filter((member) => member.active).map((member) => (
              <option key={member.phone} value={member.name}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={draft.date} onChange={(event) => setDraft({ date: event.target.value })} />
        </label>
        <label>
          <span>Start</span>
          <input value={draft.start} onChange={(event) => setDraft({ start: event.target.value })} />
        </label>
        <label>
          <span>Finish</span>
          <input value={draft.end} onChange={(event) => setDraft({ end: event.target.value })} />
        </label>
        <label className="roster-area">
          <span>Area</span>
          <input value={draft.area} onChange={(event) => setDraft({ area: event.target.value })} />
        </label>
        <button className="primary-action" onClick={addShift} disabled={!draft.staffName || !draft.date.trim() || !draft.start.trim() || !draft.end.trim() || !draft.area.trim()}>
          <Send size={18} />
          Send shift
        </button>
      </div>

      <div className="roster-calendar">
        <div className="roster-calendar-header">
          <strong>{visibleMonth}</strong>
          <span>{shifts.length} shifts scheduled</span>
        </div>
        <div className="roster-weekdays">
          {weekdayLabels.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="roster-calendar-grid">
          {calendarDays.map((day) => (
            <section className={day.inMonth ? 'roster-calendar-day' : 'roster-calendar-day muted'} key={day.iso}>
              <div className="roster-date-number">{day.day}</div>
              <div className="roster-calendar-events">
                {(shiftsByDate[day.iso] ?? []).map((shift) => (
                  <RosterCalendarEvent key={shift.id} shift={shift} deleteShift={deleteShift} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function RosterCalendarEvent({ shift, deleteShift }: { shift: RosterShift; deleteShift: (shiftId: string) => void }) {
  return (
    <div className={`roster-calendar-event ${shift.response}`}>
      <div>
        <strong>{shift.start} {shift.staffName}</strong>
        <span>{shift.area}</span>
      </div>
      <button aria-label={`Delete ${shift.staffName}'s shift on ${formatRosterDate(shift.date)}`} onClick={() => deleteShift(shift.id)}>
        <X size={13} />
      </button>
    </div>
  );
}

function buildRosterCalendar(anchorDate: string) {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const safeAnchor = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
  const firstOfMonth = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      iso: date.toISOString().slice(0, 10),
      day: date.getDate(),
      inMonth: date.getMonth() === safeAnchor.getMonth()
    };
  });
}

function StaffRoster({ shifts, updateRosterResponse }: { shifts: RosterShift[]; updateRosterResponse: (shiftId: string, response: ShiftResponse) => void }) {
  if (shifts.length === 0) {
    return (
      <div className="empty-roster">
        <Sparkles size={22} />
        <strong>No shifts sent yet</strong>
        <p>New roster requests will appear here for a quick accept or decline.</p>
      </div>
    );
  }

  return (
    <div className="staff-roster-list">
      {[...shifts].sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)).map((shift) => (
        <div className="staff-roster-row" key={shift.id}>
          <RosterShiftCard shift={shift} />
          {shift.response === 'sent' ? (
            <div className="roster-response-actions">
              <button onClick={() => updateRosterResponse(shift.id, 'accepted')}>
                <Check size={16} />
                Accept
              </button>
              <button className="decline" onClick={() => updateRosterResponse(shift.id, 'declined')}>
                <X size={16} />
                Decline
              </button>
            </div>
          ) : (
            <span className={`status-badge ${shift.response === 'accepted' ? 'green' : 'slate'}`}>{shift.response === 'accepted' ? 'Accepted' : 'Declined'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RosterShiftCard({ shift, onDelete }: { shift: RosterShift; onDelete?: (shiftId: string) => void }) {
  return (
    <div className="roster-shift-card">
      <div className="roster-shift-main">
        <span>{formatRosterDate(shift.date)}</span>
        <strong>{shift.staffName}</strong>
        <span>{shift.role} · {shift.area}</span>
      </div>
      <div className="roster-shift-meta">
        <strong>{shift.start} - {shift.end}</strong>
        <span className={`status-dot ${shift.response === 'accepted' ? 'active' : shift.response === 'declined' ? 'paused' : 'pending'}`}>
          {shift.response === 'sent' ? 'Sent' : shift.response === 'accepted' ? 'Accepted' : shift.response === 'declined' ? 'Declined' : 'Draft'}
        </span>
        {onDelete && (
          <button className="roster-delete" aria-label={`Delete ${shift.staffName}'s shift on ${formatRosterDate(shift.date)}`} onClick={() => onDelete(shift.id)}>
            <X size={15} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function formatRosterDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function rosterMonthLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function WorkflowBoard({
  jobs,
  selectedJobId,
  setSelectedJobId,
  workflowStages,
  compact = false
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'workflow-board compact' : 'workflow-board'}>
      {statusFlow.map((status, index) => {
        const columnJobs = jobs.filter((job) => job.status === status);
        return (
          <section className="workflow-column" key={status}>
            <div className="workflow-column-header">
              <span>{index + 1}</span>
              <div>
                <strong>{workflowStages[status].label}</strong>
                <small>{columnJobs.length} jobs · {workflowStages[status].nextStep}</small>
              </div>
            </div>
            <div className="workflow-cards">
              {columnJobs.map((job) => (
                <button key={job.id} className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`} onClick={() => setSelectedJobId(job.id)}>
                  <div>
                    <strong>{job.customer}</strong>
                    <span>{job.item}</span>
                  </div>
                  <div className="job-card-tags">
                    <span>{job.serviceType}</span>
                    <span className={job.priority === 'Urgent' ? 'priority urgent' : job.priority === 'Hold' ? 'priority hold' : 'priority'}>{job.priority}</span>
                  </div>
                  <div className="job-card-footer">
                    <small>{job.id} · Due {job.due}</small>
                    <PaymentBadge paid={job.paid} />
                  </div>
                </button>
              ))}
              {columnJobs.length === 0 && <p className="empty-column">Clear</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MessagingSettings({
  business,
  draft,
  updateDraft,
  connectProvider,
  disconnectProvider,
  testProvider,
  sendTestSms,
  notice
}: {
  business: Business;
  draft: { provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string };
  updateDraft: (patch: Partial<{ provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string }>) => void;
  connectProvider: () => void;
  disconnectProvider: () => void;
  testProvider: () => void;
  sendTestSms: () => void;
  notice: string;
}) {
  return (
    <div className="messaging-setup">
      <div className={business.messagingEnabled ? 'messaging-status connected' : 'messaging-status'}>
        <div>
          <strong>{business.messagingEnabled ? `${providerName(business.smsProvider)} connected` : 'SMS not configured'}</strong>
          <p>{business.messagingEnabled ? `Saved key ${business.maskedKeyPreview}. SMS costs are paid directly to ${providerName(business.smsProvider)}.` : 'Status changes still work. Customer SMS is disabled until this business connects its own provider.'}</p>
        </div>
        {business.messagingEnabled && <CheckCircle2 size={22} />}
      </div>

      <div className="setup-steps">
        <Step number="1" title="Choose provider" text="Pick the SMS provider this business will pay directly." />
        <Step number="2" title="Create provider account" text="Use ClickSend for easy Australian setup, or Telnyx for lower scale pricing." />
        <Step number="3" title="Paste credentials" text="Credentials are sent only to secure backend routes and encrypted before storage." />
        <Step number="4" title="Send test SMS" text="Confirm the provider can send from the business sender name or number." />
        <Step number="5" title="Start messaging customers" text="Job status changes will show a preview before sending." />
      </div>

      <div className="provider-options">
        <button className={draft.provider === 'clicksend' ? 'selected' : ''} onClick={() => updateDraft({ provider: 'clicksend' })}>
          <strong>ClickSend</strong>
          <span>Easiest setup for Australian businesses.</span>
        </button>
        <button className={draft.provider === 'telnyx' ? 'selected' : ''} onClick={() => updateDraft({ provider: 'telnyx' })}>
          <strong>Telnyx</strong>
          <span>Cheapest at scale, but more technical.</span>
        </button>
      </div>

      <div className="credential-form">
        <input value={draft.senderName} onChange={(event) => updateDraft({ senderName: event.target.value })} placeholder="Sender name or business name" />
        <input value={draft.username} onChange={(event) => updateDraft({ username: event.target.value })} placeholder={draft.provider === 'clicksend' ? 'ClickSend username' : 'Telnyx profile or account ID'} />
        <input value={draft.apiKey} onChange={(event) => updateDraft({ apiKey: event.target.value })} placeholder="API key or password" type="password" autoComplete="off" />
        <input value={draft.fromNumber} onChange={(event) => updateDraft({ fromNumber: event.target.value })} placeholder="Optional sending number" />
      </div>

      <div className="messaging-actions">
        <button onClick={testProvider}>Test Connection</button>
        <button onClick={connectProvider}>Save Provider Securely</button>
        <button onClick={sendTestSms}>Send Test SMS</button>
        <button className="danger" onClick={disconnectProvider}>Disconnect Provider</button>
      </div>

      {notice && <p className="messaging-notice">{notice}</p>}
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="setup-step">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function providerName(provider: SmsProvider | null) {
  if (provider === 'clicksend') return 'ClickSend';
  if (provider === 'telnyx') return 'Telnyx';
  return 'No provider';
}

function SmsPreviewModal({
  preview,
  provider,
  onSend,
  onCopy,
  onClose
}: {
  preview: SmsPreview;
  provider: SmsProvider | null;
  onSend: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="sms-modal">
        <span className="eyebrow">SMS preview</span>
        <h2>Send customer update?</h2>
        <p>{providerName(provider)} will send this SMS. Verola does not pay for or bill SMS usage.</p>
        <div className="sms-preview-box">
          <strong>{preview.customer} · {preview.phone}</strong>
          <p>{preview.message}</p>
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Continue without SMS</button>
          <button onClick={onCopy}>Copy message</button>
          <button onClick={onSend}>Send SMS</button>
        </div>
      </div>
    </div>
  );
}

function SmsTemplateEditor({
  templates,
  setTemplate,
  workflowStages
}: {
  templates: Record<JobStatus, string>;
  setTemplate: (status: JobStatus, body: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
}) {
  return (
    <div className="template-list editable">
      {statusFlow.map((status) => (
        <label className="template-item" key={status}>
          <div className="template-heading">
            <strong>{workflowStages[status].label}</strong>
            <span>{'{{customer}}'} {'{{business}}'}</span>
          </div>
          <textarea value={templates[status]} onChange={(event) => setTemplate(status, event.target.value)} rows={3} />
        </label>
      ))}
    </div>
  );
}

function WorkflowStageEditor({
  stages,
  setStage
}: {
  stages: Record<JobStatus, WorkflowStage>;
  setStage: (status: JobStatus, patch: Partial<WorkflowStage>) => void;
}) {
  return (
    <div className="workflow-editor">
      {statusFlow.map((status, index) => (
        <div className="workflow-editor-row" key={status}>
          <span>{index + 1}</span>
          <input value={stages[status].label} onChange={(event) => setStage(status, { label: event.target.value })} placeholder="Stage name" />
          <input value={stages[status].verb} onChange={(event) => setStage(status, { verb: event.target.value })} placeholder="Button label" />
          <input value={stages[status].nextStep} onChange={(event) => setStage(status, { nextStep: event.target.value })} placeholder="Next step hint" />
        </div>
      ))}
    </div>
  );
}

function JobDetail({
  job,
  updateJobStatus,
  addJobNote,
  toggleJobPaid,
  workflowStages,
  compact = false
}: {
  job?: Job;
  updateJobStatus?: (jobId: string, status: JobStatus) => void;
  addJobNote: (jobId: string, note: string) => void;
  toggleJobPaid: (jobId: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  compact?: boolean;
}) {
  const [draftNote, setDraftNote] = useState('');

  if (!job) {
    return (
      <div className="job-detail empty">
        <Sparkles size={24} />
        <strong>No matching jobs</strong>
      </div>
    );
  }

  return (
    <div className="job-detail">
      <div className="job-title">
        <div>
          <span className="eyebrow">{job.id} · Due {job.due}</span>
          <h2>{job.customer}</h2>
          <p>{job.phone} · {job.item}</p>
        </div>
        <div className="job-title-badges">
          <PaymentBadge paid={job.paid} />
          <StatusBadge status={job.status} workflowStages={workflowStages} />
        </div>
      </div>

      {!compact && (
        <div className="customer-link-row">
          <span>Customer tracking page</span>
          <a href={`/track/${encodeURIComponent(job.id)}`}>Open customer view</a>
        </div>
      )}

      <div className={job.paid ? 'payment-panel paid' : 'payment-panel'}>
        <div>
          <strong>{job.paid ? 'Payment received' : 'Payment not received'}</strong>
          <p>{job.paid ? `Marked paid ${job.paidAt}` : 'Customer can pay before collection or at pickup.'}</p>
        </div>
        <button onClick={() => toggleJobPaid(job.id)}>{job.paid ? 'Mark unpaid' : 'Mark paid'}</button>
      </div>

      {updateJobStatus ? (
        <div className="status-buttons">
          {statusFlow.map((status) => (
            <button key={status} className={`status-action ${job.status === status ? 'current' : ''}`} onClick={() => updateJobStatus(job.id, status)}>
              {status === 'collected' && <Shirt size={18} />}
              {status === 'in_progress' && <Wrench size={18} />}
              {status === 'ready_for_pickup' && <Send size={18} />}
              {status === 'completed' && <Check size={18} />}
              <span>{workflowStages[status].verb}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="progress-readonly">
          {statusFlow.map((status, index) => (
            <div key={status} className={statusFlow.indexOf(job.status) >= index ? 'progress-step done' : 'progress-step'}>
              <span>{index + 1}</span>
              <strong>{workflowStages[status].label}</strong>
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <div className="job-note">
          <strong>Notes</strong>
          {job.notes.split('\n').map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      )}

      <div className="note-composer">
        <textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Add an internal note for the next person..." rows={3} />
        <button
          disabled={!draftNote.trim()}
          onClick={() => {
            addJobNote(job.id, draftNote);
            setDraftNote('');
          }}
        >
          <Plus size={16} />
          Add note
        </button>
      </div>

      <div className="timeline">
        {job.updates.map((update, index) => (
          <div className="timeline-item" key={`${update.status}-${update.at}-${index}`}>
            <span />
            <div>
              <strong>{update.kind === 'note' ? 'Note added' : update.kind === 'payment' ? 'Payment update' : workflowStages[update.status ?? job.status].label} · {update.at}</strong>
              <p>{update.sms}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <section className="metric">
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function PanelHeader({ icon: Icon, title, action }: { icon: typeof Settings; title: string; action?: string }) {
  return (
    <div className="panel-header">
      <div>
        <Icon size={19} />
        <h2>{title}</h2>
      </div>
      {action && <span className="panel-action">{action}</span>}
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BrandMark({ className = '' }: { className?: string }) {
  const brand = useBranding();
  const initials = brand.name.split(' ').map((word) => word[0]).join('').slice(0, 2) || 'V';
  return (
    <div className={`business-logo ${className}`} style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <span>{initials}</span>
      {brand.logoUrl && <img src={brand.logoUrl} alt={`${brand.name} logo`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    </div>
  );
}

function BusinessLogo({ business, className = '' }: { business: Business; className?: string }) {
  const initials = business.name.split(' ').map((word) => word[0]).join('').slice(0, 2) || 'V';

  return (
    <div className={`business-logo ${className}`} style={{ '--brand': business.primary, '--accent': business.accent } as React.CSSProperties}>
      <span>{initials}</span>
      {business.logoUrl && <img src={business.logoUrl} alt={`${business.name} logo`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    </div>
  );
}

function StatusBadge({ status, workflowStages }: { status: JobStatus; workflowStages: Record<JobStatus, WorkflowStage> }) {
  return <span className={`status-badge ${workflowStages[status].tone}`}>{workflowStages[status].label}</span>;
}

function PaymentBadge({ paid }: { paid: boolean }) {
  return <span className={paid ? 'payment-badge paid' : 'payment-badge unpaid'}>{paid ? 'Paid' : 'Unpaid'}</span>;
}

export default App;
