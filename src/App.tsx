import { useEffect, useMemo, useRef, useState } from 'react';
import { ExecutionMethod } from 'appwrite';
import {
  Activity,
  Bell,
  Building2,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  History,
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
  Users,
  X,
  Wrench
} from 'lucide-react';
import { ID } from 'appwrite';
import {
  appBaseUrl,
  appwriteClient,
  appwriteDatabaseId,
  appwriteInviteFunctionId,
  appwriteSmsFunctionId,
  appwriteLogoBucketId,
  appwriteOrganisationCollectionId,
  account,
  databases,
  functions,
  hasAppwriteConfig,
  Query,
  storage
} from './lib/appwrite';
import { BrandProvider, OrganisationBrand, platformBrand, useBranding } from './lib/branding';

type Portal = 'super' | 'admin' | 'staff';
type UserRole = Portal;
type JobStatus = 'collected' | 'in_progress' | 'ready_for_pickup' | 'completed';
type OrderFilter = 'all' | 'collected' | 'in_progress' | 'ready_for_pickup' | 'completed';
type SimpleOrderFilter = 'all' | 'collected' | 'in_progress' | 'ready_for_pickup';
type BusinessJobsView = 'active' | 'completed' | 'history';
type SmsProvider = 'clicksend' | 'telnyx';
type SmsSetupStatus = 'not_configured' | 'connected' | 'failed';
type ShiftResponse = 'draft' | 'sent' | 'accepted' | 'declined';
type InviteStatus = 'pending' | 'accepted' | 'expired';

type RosterShiftDocument = {
  $id: string;
  organisationId: string;
  staffUserId?: string;
  staffName: string;
  role?: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  area?: string;
  responseStatus?: ShiftResponse;
  respondedAt?: string;
  createdBy?: string;
};

type StaffShiftDocument = {
  $id: string;
  $createdAt?: string;
  organisationId: string;
  staffUserId: string;
  staffName: string;
  clockInAt: string;
  clockOutAt?: string;
  status: 'clocked_in' | 'clocked_out';
  totalMinutes?: number;
};

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
  role: 'business_admin' | 'staff';
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
  updates: Array<{ status?: JobStatus; at: string; sms: string; kind?: 'status' | 'note' | 'payment' | 'sms' | 'sms_failed' }>;
};

type MasterSmsSettings = {
  provider: SmsProvider;
  senderName: string;
  status: SmsSetupStatus;
  maskedKeyPreview?: string;
  lastTestedAt?: string;
};

type MasterSmsDraft = {
  provider: SmsProvider;
  senderName: string;
  apiKey: string;
  username: string;
  fromNumber: string;
};

type SmsLog = {
  id: string;
  businessId: string;
  businessName: string;
  recipient: string;
  templateKey: JobStatus | 'test';
  status: 'sent' | 'failed';
  timestamp: string;
  provider: SmsProvider;
  response: string;
};

type WorkflowToast = {
  id: number;
  tone: 'success' | 'warning';
  message: string;
};

type JobNotification = {
  state: 'delivered' | 'ready' | 'failed' | 'none';
  label: string;
  time: string;
  message: string;
};

type StaffMember = {
  businessId: string;
  name: string;
  role: 'Owner' | 'Manager' | 'Staff';
  email?: string;
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
  staffUserId?: string;
  staffName: string;
  role: string;
  date: string;
  start: string;
  end: string;
  area: string;
  response: ShiftResponse;
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
};

const platformFallbackBusiness: Business = {
  id: 'platform-fallback',
  name: 'No organisation selected',
  industry: 'Create an organisation',
  location: 'Verola',
  plan: 'Starter',
  active: true,
  staff: 0,
  sms: 0,
  jobs: 0,
  primary: platformBrand.primary,
  accent: platformBrand.accent,
  sender: 'VEROLA',
  messagingEnabled: false,
  smsProvider: null,
  smsSenderName: 'VEROLA',
  smsSetupStatus: 'not_configured'
};

const initialBusinesses: Business[] = [];

const initialStaffMembers: StaffMember[] = [];
const initialRosterShifts: RosterShift[] = [];
const initialJobs: Job[] = [];

const statusFlow: JobStatus[] = ['collected', 'in_progress', 'ready_for_pickup', 'completed'];

const defaultWorkflowStages: Record<JobStatus, WorkflowStage> = {
  collected: {
    label: 'Received',
    verb: 'Move to Received',
    nextStep: 'Start the work',
    tone: 'blue'
  },
  in_progress: {
    label: 'In Progress',
    verb: 'Move to In Progress',
    nextStep: 'Finish and mark ready',
    tone: 'amber'
  },
  ready_for_pickup: {
    label: 'Ready',
    verb: 'Move to Ready',
    nextStep: 'Notify and hand over',
    tone: 'green'
  },
  completed: {
    label: 'Completed',
    verb: 'Complete Order',
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

const inviteStorageKey = 'verola.organisationInvites.v6';
const businessStorageKey = 'verola.businesses.v6';
const userStorageKey = 'verola.createdUsers.v6';
const authStorageKey = 'verola.authUser.v6';
const activeBusinessStorageKey = 'verola.activeBusinessId.v6';
const jobsStorageKey = 'verola.jobs.v6';
const rosterStorageKey = 'verola.rosters.v6';
const staffStorageKey = 'verola.staff.v2';
const workflowStorageKey = 'verola.workflowStages.v2';
const smsTemplateStorageKey = 'verola.smsTemplates.v2';
const masterSmsStorageKey = 'verola.masterSmsSettings.v1';
const smsLogsStorageKey = 'verola.smsLogs.v1';

const platformUsers: AuthUser[] = [
  { email: 'moey1722001@gmail.com', name: 'Platform Owner', role: 'super' }
];

const platformOwnerPasswordHash = '6d7c8cf940fcbb15e4a46bb697fd8560022500ffe874e50117a292f8cbc6a469';
const defaultEmailByRole: Record<UserRole, string> = {
  super: 'moey1722001@gmail.com',
  admin: '',
  staff: ''
};
const productHighlights = [
  'Branded portals for each business and team',
  'Simple active job queue with automatic customer updates',
  'Rosters, shift responses, and clock-in visibility',
  'Clean history for payments, notes, and customer messages'
];
const defaultMasterSmsSettings: MasterSmsSettings = {
  provider: 'clicksend',
  senderName: 'VEROLA',
  status: 'not_configured'
};
const defaultSmsTemplates: Record<JobStatus, string> = {
  collected: 'Hi {{customer}}, {{business}} has received your order. We will update you soon.',
  in_progress: 'Hi {{customer}}, your order at {{business}} is now in progress.',
  ready_for_pickup: 'Hi {{customer}}, your order is ready for pickup at {{business}}.',
  completed: 'Thanks {{customer}}. Your order with {{business}} is complete.'
};

type IndustryPreset = {
  label: string;
  description: string;
  stages: Record<JobStatus, WorkflowStage>;
  templates: Record<JobStatus, string>;
};

const industryPresets: Record<string, IndustryPreset> = {
  laundromat: {
    label: 'Laundromat / dry cleaner',
    description: 'Drop-off orders, washing/cleaning, pickup notifications.',
    stages: {
      collected: { label: 'Received', verb: 'Mark received', nextStep: 'Order added to queue', tone: 'blue' },
      in_progress: { label: 'Washing', verb: 'Start work', nextStep: 'Staff processing order', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready for pickup', nextStep: 'Customer can collect', tone: 'green' },
      completed: { label: 'Picked up', verb: 'Complete order', nextStep: 'Archived for the day', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, {{business}} has received your order. We will text you when it is underway.',
      in_progress: 'Hi {{customer}}, your order at {{business}} is now being processed.',
      ready_for_pickup: 'Hi {{customer}}, your order is ready for pickup at {{business}}.',
      completed: 'Thanks {{customer}}. Your order has been picked up from {{business}}.'
    }
  },
  mechanic: {
    label: 'Mechanic / repair shop',
    description: 'Vehicles, inspections, repairs, approval and pickup flow.',
    stages: {
      collected: { label: 'Checked in', verb: 'Check in', nextStep: 'Vehicle or item received', tone: 'blue' },
      in_progress: { label: 'Inspecting', verb: 'Start inspection', nextStep: 'Work or inspection underway', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready for pickup', nextStep: 'Customer can collect or approve', tone: 'green' },
      completed: { label: 'Collected', verb: 'Complete job', nextStep: 'Job closed', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, {{business}} has checked in your job. We will keep you updated.',
      in_progress: 'Hi {{customer}}, {{business}} has started work on your job.',
      ready_for_pickup: 'Hi {{customer}}, your job is ready at {{business}}. Please contact us if you need anything before pickup.',
      completed: 'Thanks {{customer}}. Your job with {{business}} is now complete.'
    }
  },
  vet: {
    label: 'Vet clinic',
    description: 'Pet check-in, treatment progress, discharge and pickup.',
    stages: {
      collected: { label: 'Checked in', verb: 'Check in pet', nextStep: 'Pet is with the clinic team', tone: 'blue' },
      in_progress: { label: 'With vet', verb: 'Start consult', nextStep: 'Vet team is treating or assessing', tone: 'amber' },
      ready_for_pickup: { label: 'Ready for pickup', verb: 'Ready for pickup', nextStep: 'Owner can collect pet', tone: 'green' },
      completed: { label: 'Discharged', verb: 'Discharge pet', nextStep: 'Visit archived', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, your pet has been checked in at {{business}}. We will keep you updated.',
      in_progress: 'Hi {{customer}}, your pet is now with the team at {{business}}.',
      ready_for_pickup: 'Hi {{customer}}, your pet is ready for pickup at {{business}}.',
      completed: 'Thanks {{customer}}. Your visit with {{business}} is now complete.'
    }
  },
  grooming: {
    label: 'Pet groomer',
    description: 'Pet arrival, grooming underway, ready for pickup.',
    stages: {
      collected: { label: 'Arrived', verb: 'Pet arrived', nextStep: 'Pet checked in for grooming', tone: 'blue' },
      in_progress: { label: 'Grooming', verb: 'Start grooming', nextStep: 'Grooming is underway', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready for pickup', nextStep: 'Owner can return', tone: 'green' },
      completed: { label: 'Picked up', verb: 'Complete visit', nextStep: 'Visit archived', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, your pet has arrived at {{business}}. We will text when grooming starts.',
      in_progress: 'Hi {{customer}}, grooming has started at {{business}}.',
      ready_for_pickup: 'Hi {{customer}}, your pet is ready for pickup at {{business}}.',
      completed: 'Thanks {{customer}}. Your grooming visit with {{business}} is complete.'
    }
  },
  beauty: {
    label: 'Beauty / clinic',
    description: 'Client arrival, service progress, ready and completed visits.',
    stages: {
      collected: { label: 'Arrived', verb: 'Mark arrived', nextStep: 'Client checked in', tone: 'blue' },
      in_progress: { label: 'In service', verb: 'Start service', nextStep: 'Treatment or appointment underway', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready / wrap up', nextStep: 'Client can finalise visit', tone: 'green' },
      completed: { label: 'Completed', verb: 'Complete visit', nextStep: 'Visit archived', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, you are checked in at {{business}}.',
      in_progress: 'Hi {{customer}}, your appointment at {{business}} has started.',
      ready_for_pickup: 'Hi {{customer}}, your appointment at {{business}} is wrapping up now.',
      completed: 'Thanks {{customer}}. Your visit with {{business}} is complete.'
    }
  },
  tailoring: {
    label: 'Tailoring / alterations',
    description: 'Garment drop-offs, alteration work, fitting and collection.',
    stages: {
      collected: { label: 'Received', verb: 'Receive garment', nextStep: 'Garment added to queue', tone: 'blue' },
      in_progress: { label: 'Altering', verb: 'Start alteration', nextStep: 'Tailor is working on garment', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready for fitting', nextStep: 'Customer can collect or fit', tone: 'green' },
      completed: { label: 'Collected', verb: 'Complete order', nextStep: 'Order archived', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, {{business}} has received your garment for alteration.',
      in_progress: 'Hi {{customer}}, your alteration is now underway at {{business}}.',
      ready_for_pickup: 'Hi {{customer}}, your garment is ready at {{business}}.',
      completed: 'Thanks {{customer}}. Your alteration order with {{business}} is complete.'
    }
  },
  repair: {
    label: 'General repair shop',
    description: 'Device/item check-in, repair progress, pickup and close-out.',
    stages: {
      collected: { label: 'Checked in', verb: 'Check in item', nextStep: 'Item received by team', tone: 'blue' },
      in_progress: { label: 'Repairing', verb: 'Start repair', nextStep: 'Repair is underway', tone: 'amber' },
      ready_for_pickup: { label: 'Ready', verb: 'Ready for pickup', nextStep: 'Customer can collect item', tone: 'green' },
      completed: { label: 'Collected', verb: 'Complete repair', nextStep: 'Job archived', tone: 'slate' }
    },
    templates: {
      collected: 'Hi {{customer}}, {{business}} has checked in your item for repair.',
      in_progress: 'Hi {{customer}}, your repair is now underway at {{business}}.',
      ready_for_pickup: 'Hi {{customer}}, your item is ready for pickup at {{business}}.',
      completed: 'Thanks {{customer}}. Your repair with {{business}} is complete.'
    }
  },
  service: {
    label: 'General service business',
    description: 'Simple received, in progress, ready and completed workflow.',
    stages: defaultWorkflowStages,
    templates: defaultSmsTemplates
  }
};

const industryPresetOptions = ['laundromat', 'mechanic', 'vet', 'grooming', 'beauty', 'tailoring', 'repair', 'service'];

function cloneWorkflowStages(stages: Record<JobStatus, WorkflowStage>) {
  return Object.fromEntries(statusFlow.map((status) => [status, { ...stages[status] }])) as Record<JobStatus, WorkflowStage>;
}

function cloneSmsTemplates(templates: Record<JobStatus, string>) {
  return { ...templates };
}

function industryPresetKey(industry?: string) {
  const value = (industry || '').toLowerCase();
  if (/(laundry|laundromat|dry cleaner|drycleaner|wash|fold)/.test(value)) return 'laundromat';
  if (/(vet|veterinary|animal|pet clinic)/.test(value)) return 'vet';
  if (/(groom|pet groom|dog wash)/.test(value)) return 'grooming';
  if (/(beauty|clinic|salon|appointment|barber|skin|cosmetic)/.test(value)) return 'beauty';
  if (/(tailor|alteration|garment|clothing)/.test(value)) return 'tailoring';
  if (/(mechanic|auto|vehicle|detailing|panel|tyre|tire)/.test(value)) return 'mechanic';
  if (/(phone|device|computer|appliance|repair)/.test(value)) return 'repair';
  return 'service';
}

function industryPresetFor(industry?: string) {
  return industryPresets[industryPresetKey(industry)];
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function portalFromPath(pathname: string): Portal {
  if (pathname.startsWith('/super-admin')) return 'super';
  if (pathname.startsWith('/staff')) return 'staff';
  return 'admin';
}

function isInvitePath(pathname: string) {
  return pathname.startsWith('/invite/') || pathname.startsWith('/accept-invite') || pathname.startsWith('/setup-business/');
}

function inviteTokenFromPath(pathname: string) {
  // Legacy path format: /invite/TOKEN or /setup-business/TOKEN
  const legacyMatch = pathname.match(/^\/(?:invite|setup-business)\/([^/]+)/);
  if (legacyMatch) return decodeURIComponent(legacyMatch[1]);
  // New magic URL format: /accept-invite/INVITE_ID (Appwrite appends ?userId=&secret=)
  const idMatch = pathname.match(/^\/accept-invite\/([^/?]+)/);
  if (idMatch) return decodeURIComponent(idMatch[1]);
  // Copy-link fallback: /accept-invite?token=TOKEN
  if (pathname === '/accept-invite' || pathname.startsWith('/accept-invite?')) {
    return new URLSearchParams(window.location.search).get('token') ?? '';
  }
  return '';
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
  if (!value || value.includes('created')) return value || 'Just now';
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
  let documents: unknown[];
  if (appwriteInviteFunctionId) {
    try {
      const execution = await functions.createExecution(
        appwriteInviteFunctionId,
        JSON.stringify({ action: 'list_organisations' }),
        false,
        '/',
        ExecutionMethod.POST,
        { 'content-type': 'application/json' }
      );
      const result = execution as { responseStatusCode?: number; responseBody?: string };
      const payload = result.responseBody ? JSON.parse(result.responseBody) as { organisations?: unknown[]; error?: string } : {};
      if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
        throw new Error(payload.error || 'Organisation lookup function failed.');
      }
      documents = payload.organisations || [];
    } catch (error) {
      debugPersistence('organisation function lookup failed, trying client database read', error instanceof Error ? error.message : error);
      const response = await databases.listDocuments(appwriteDatabaseId, appwriteOrganisationCollectionId);
      documents = response.documents;
    }
  } else {
    const response = await databases.listDocuments(appwriteDatabaseId, appwriteOrganisationCollectionId);
    documents = response.documents;
  }
  const retiredStarterNames = new Set([
    'Fresh Fold Laundry',
    'Rapid Auto Care',
    'Stitch Studio',
    'Paws & Polish Grooming',
    'Glow Lane Beauty',
    'Verola Workspace'
  ]);
  const businesses = documents
    .map((document) => businessFromOrganisationDocument(document as unknown as OrganisationDocument))
    .filter((business) => {
      const normalizedName = business.name.trim().toLowerCase();
      return business.id !== 'verola-workspace'
        && !Array.from(retiredStarterNames).some((name) => name.toLowerCase() === normalizedName)
        && !normalizedName.includes('verola workspace');
    });
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

async function saveOrganisationThroughFunction(business: Business) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return false;
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({
      action: 'save_organisation',
      business: organisationPayloadFromBusiness(business),
      businessId: business.id
    }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { saved?: boolean; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error || !payload.saved) {
    throw new Error(payload.error || 'Organisation persistence function failed.');
  }
  return true;
}

async function saveBrandingThroughFunction(businessId: string, file: File, dataUrl: string) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return null;
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({
      action: 'save_branding',
      businessId,
      logoName: file.name,
      logoType: file.type,
      logoDataUrl: dataUrl
    }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { saved?: boolean; logoUrl?: string; logoFileId?: string; logoName?: string; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error || !payload.saved) {
    throw new Error(payload.error || 'Logo persistence function failed.');
  }
  return payload;
}

async function removeBrandingThroughFunction(businessId: string, logoFileId?: string) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return false;
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({
      action: 'remove_branding',
      businessId,
      logoFileId
    }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { removed?: boolean; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error || !payload.removed) {
    throw new Error(payload.error || 'Logo removal function failed.');
  }
  return true;
}

function rosterShiftFromDocument(document: RosterShiftDocument): RosterShift {
  return {
    id: document.$id,
    businessId: document.organisationId,
    staffUserId: document.staffUserId,
    staffName: document.staffName,
    role: document.role || 'Staff',
    date: document.shiftDate,
    start: document.startTime,
    end: document.endTime,
    area: document.area || 'Shift',
    response: document.responseStatus || 'sent',
    respondedAt: document.respondedAt,
    sentAt: 'Synced'
  };
}

function rosterShiftPayload(shift: RosterShift, createdBy = 'business_admin') {
  return {
    organisationId: shift.businessId,
    staffUserId: shift.staffUserId || staffUserIdFor(shift.staffName),
    staffName: shift.staffName,
    role: shift.role,
    shiftDate: shift.date,
    startTime: shift.start,
    endTime: shift.end,
    area: shift.area,
    responseStatus: shift.response,
    respondedAt: shift.respondedAt,
    createdBy
  };
}

async function fetchPersistedRosterShifts(businessId: string) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return [];
  const response = await databases.listDocuments(appwriteDatabaseId, 'rosterShifts', [Query.equal('organisationId', businessId)]);
  return response.documents.map((document) => rosterShiftFromDocument(document as unknown as RosterShiftDocument));
}

async function fetchRosterShiftsThroughFunction(businessId: string) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return [];
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({ action: 'list_roster_shifts', businessId }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { shifts?: RosterShift[]; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
    throw new Error(payload.error || 'Roster lookup failed.');
  }
  return payload.shifts || [];
}

async function persistRosterShift(shift: RosterShift, createdBy?: string) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  const payload = rosterShiftPayload(shift, createdBy);
  try {
    await databases.updateDocument(appwriteDatabaseId, 'rosterShifts', shift.id, payload);
  } catch {
    await databases.createDocument(appwriteDatabaseId, 'rosterShifts', shift.id, payload);
  }
  return true;
}

async function patchRosterShift(shift: RosterShift) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  await databases.updateDocument(appwriteDatabaseId, 'rosterShifts', shift.id, rosterShiftPayload(shift));
  return true;
}

async function patchRosterShiftThroughFunction(shift: RosterShift) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return false;
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({
      action: 'update_roster_shift',
      shift: { id: shift.id, ...rosterShiftPayload(shift) }
    }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { saved?: boolean; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error || !payload.saved) {
    throw new Error(payload.error || 'Roster response function failed.');
  }
  return true;
}

async function deletePersistedRosterShift(shiftId: string) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  await databases.deleteDocument(appwriteDatabaseId, 'rosterShifts', shiftId);
  return true;
}

type StaffClockState = {
  staffUserId: string;
  staffName: string;
  clockedIn: boolean;
  clockInAt?: string;
  lastShift: string;
  hoursToday: number;
};

function staffClockPayload(member: StaffMember, businessId: string, clockingOut: boolean) {
  const now = new Date().toISOString();
  return {
    organisationId: businessId,
    staffUserId: staffUserIdFor(member),
    staffName: member.name,
    clockInAt: clockingOut ? new Date(Date.now() - Math.max(member.hoursToday, 0.1) * 60 * 60 * 1000).toISOString() : now,
    clockOutAt: clockingOut ? now : undefined,
    status: clockingOut ? 'clocked_out' : 'clocked_in',
    totalMinutes: clockingOut ? Math.max(1, Math.round(Math.max(member.hoursToday, 0.1) * 60)) : undefined
  };
}

function staffClockStateFromDocument(document: StaffShiftDocument): StaffClockState {
  const clockIn = new Date(document.clockInAt);
  const clockOut = document.clockOutAt ? new Date(document.clockOutAt) : undefined;
  const totalMinutes = document.totalMinutes ?? (
    clockOut
      ? Math.max(1, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000))
      : Math.max(1, Math.round((Date.now() - clockIn.getTime()) / 60000))
  );
  return {
    staffUserId: document.staffUserId,
    staffName: document.staffName,
    clockedIn: document.status === 'clocked_in',
    clockInAt: document.status === 'clocked_in' ? nowLabel(clockIn) : undefined,
    lastShift: document.status === 'clocked_in' ? `Since ${nowLabel(clockIn)}` : nowLabel(clockOut || clockIn),
    hoursToday: Math.round((totalMinutes / 60) * 10) / 10
  };
}

function mergeStaffClockStates(staff: StaffMember[], states: StaffClockState[], businessId: string) {
  if (!states.length) return staff;
  const byId = new Map(states.map((state) => [state.staffUserId, state]));
  const next = staff.map((member) => {
    if (member.businessId && member.businessId !== businessId) return member;
    const state = byId.get(staffUserIdFor(member));
    if (!state) return member;
    return {
      ...member,
      clockedIn: state.clockedIn,
      clockInAt: state.clockInAt,
      lastShift: state.clockedIn ? state.lastShift : state.lastShift,
      hoursToday: state.hoursToday
    };
  });

  states.forEach((state) => {
    const exists = next.some((member) => member.businessId === businessId && staffUserIdFor(member) === state.staffUserId);
    if (!exists) {
      next.push({
        businessId,
        name: state.staffName,
        role: 'Staff',
        email: state.staffUserId.includes('@') ? state.staffUserId : undefined,
        phone: state.staffUserId,
        active: true,
        clockedIn: state.clockedIn,
        clockInAt: state.clockInAt,
        hoursToday: state.hoursToday,
        lastShift: state.lastShift
      });
    }
  });
  return next;
}

async function persistStaffClock(member: StaffMember, businessId: string, clockingOut: boolean) {
  if (!hasAppwriteConfig || !appwriteDatabaseId) return false;
  const documentId = `clock-${staffUserIdFor(member)}-${Date.now()}`.slice(0, 36);
  await databases.createDocument(appwriteDatabaseId, 'staffShifts', documentId, staffClockPayload(member, businessId, clockingOut));
  return true;
}

async function persistStaffClockThroughFunction(member: StaffMember, businessId: string, clockingOut: boolean) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return false;
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({
      action: 'staff_clock_event',
      businessId,
      staffUserId: staffUserIdFor(member),
      staffName: member.name,
      clockingOut,
      hoursToday: member.hoursToday
    }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { saved?: boolean; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error || !payload.saved) {
    throw new Error(payload.error || 'Clock event function failed.');
  }
  return true;
}

async function fetchStaffClockStatesThroughFunction(businessId: string) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return [];
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({ action: 'list_staff_clock', businessId }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { states?: StaffClockState[]; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
    throw new Error(payload.error || 'Clock state lookup failed.');
  }
  return (payload.states || []).map((state) => {
    const clockInDate = state.clockInAt ? new Date(state.clockInAt) : undefined;
    const lastShiftDate = state.lastShift ? new Date(state.lastShift) : undefined;
    return {
      ...state,
      clockInAt: clockInDate && !Number.isNaN(clockInDate.getTime()) ? nowLabel(clockInDate) : state.clockInAt,
      lastShift: state.clockedIn
        ? (clockInDate && !Number.isNaN(clockInDate.getTime()) ? `Since ${nowLabel(clockInDate)}` : state.lastShift)
        : (lastShiftDate && !Number.isNaN(lastShiftDate.getTime()) ? nowLabel(lastShiftDate) : state.lastShift)
    };
  });
}

async function fetchInvitesThroughFunction(businessId: string) {
  if (!hasAppwriteConfig || !appwriteInviteFunctionId) return [];
  const execution = await functions.createExecution(
    appwriteInviteFunctionId,
    JSON.stringify({ action: 'list_invites_by_org', businessId }),
    false,
    '/',
    ExecutionMethod.POST,
    { 'content-type': 'application/json' }
  );
  const result = execution as { responseStatusCode?: number; responseBody?: string };
  const payload = result.responseBody ? JSON.parse(result.responseBody) as { invites?: OrganisationInvite[]; error?: string } : {};
  if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
    throw new Error(payload.error || 'Invite lookup failed.');
  }
  return (payload.invites || []).map((invite) => normalizeInvite(invite));
}

function inviteStatus(invite: OrganisationInvite): InviteStatus {
  if (invite.status === 'accepted') return 'accepted';
  return new Date(invite.expiresAt).getTime() < Date.now() ? 'expired' : 'pending';
}

function normalizeInvite(invite: Partial<OrganisationInvite> & { id: string; businessId: string; businessName: string; adminEmail: string }): OrganisationInvite {
  const createdAt = invite.createdAt || new Date().toISOString();
  const token = invite.token || invite.id || generateInviteToken();
  const role = invite.role === 'staff' ? 'staff' : 'business_admin';
  return {
    id: invite.id || `INV-${Date.now()}`,
    token,
    businessId: invite.businessId,
    businessName: invite.businessName,
    contactName: invite.contactName || 'Business owner',
    adminEmail: invite.adminEmail,
    phone: invite.phone || '',
    role,
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
  const mainLogoUrl = business.logoUrl || platformBrand.logoUrl;
  return {
    name: business.name,
    tagline: `${business.industry} · ${business.location}`,
    logoUrl: mainLogoUrl,
    appIconUrl: business.appIconUrl || business.logoUrl || platformBrand.appIconUrl,
    faviconUrl: business.faviconUrl || business.appIconUrl || business.logoUrl || platformBrand.faviconUrl,
    lightLogoUrl: business.lightLogoUrl || mainLogoUrl,
    darkLogoUrl: business.darkLogoUrl || mainLogoUrl,
    emailHeaderLogoUrl: business.emailHeaderLogoUrl || mainLogoUrl,
    primary: business.primary || platformBrand.primary,
    accent: business.accent || platformBrand.accent,
    poweredBy: 'Verola'
  };
}

function inviteFromUrl(tokenOrId: string): OrganisationInvite | undefined {
  const params = new URLSearchParams(window.location.search);
  // Query-param invite (copy-link format): /accept-invite?token=TOKEN&business=...&email=...
  const business = params.get('business');
  const email = params.get('email');
  const token = params.get('token') || tokenOrId;
  const inviteId = params.get('inviteId') || tokenOrId;
  if (!business || !email) return undefined;
  return {
    id: inviteId,
    token,
    businessId: params.get('businessId') || businessIdFromName(business),
    businessName: business,
    contactName: params.get('contact') || 'Business owner',
    adminEmail: email,
    phone: params.get('phone') || '',
    role: params.get('role') === 'staff' ? 'staff' : 'business_admin',
    status: 'pending',
    sentAt: 'Invite link',
    createdAt: params.get('created') || new Date().toISOString(),
    expiresAt: params.get('expires') || addDays(new Date(), 14)
  };
}

function getAppBaseUrl() {
  const configured = appBaseUrl && !appBaseUrl.includes('your-vercel-domain.com') ? appBaseUrl : '';
  if (typeof window === 'undefined') return configured || 'https://verolaa.vercel.app';
  const origin = window.location.origin;
  const hostname = new URL(origin).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return origin;
  return configured || origin || 'https://verolaa.vercel.app';
}

function isLocalPreviewHost() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function buildInviteUrl(invite: OrganisationInvite) {
  const baseUrl = getAppBaseUrl();
  const params = new URLSearchParams({
    token: invite.token,
    businessId: invite.businessId,
    business: invite.businessName,
    email: invite.adminEmail,
    contact: invite.contactName || 'Business owner',
    role: invite.role,
    expires: invite.expiresAt,
    created: invite.createdAt,
    inviteId: invite.id,
  });
  if (invite.phone) params.set('phone', invite.phone);
  return `${baseUrl}/accept-invite?${params.toString()}`;
}

function buildPersonalisedInviteMessage(invite: OrganisationInvite) {
  const url = buildInviteUrl(invite);
  const greeting = invite.contactName && invite.contactName !== 'Business owner' ? `Hi ${invite.contactName},` : 'Hi,';
  const isStaffInvite = invite.role === 'staff';
  const body = [
    greeting,
    '',
    isStaffInvite
      ? `You have been invited to join ${invite.businessName} on Verola as a staff member.`
      : `Verola has created a branded business portal for ${invite.businessName}.`,
    '',
    isStaffInvite
      ? 'Use this secure setup link to create your Staff account:'
      : 'Use this secure setup link to create your Business Admin account:',
    url,
    '',
    isStaffInvite
      ? 'Once setup is complete, you can view jobs, reply to shifts, clock in/out, and work from the staff dashboard.'
      : 'Once setup is complete, you can add customer jobs, track progress, manage staff workflow, and prepare customer updates from your own branded dashboard.',
    '',
    `This invite is for ${invite.adminEmail} and expires on ${new Date(invite.expiresAt).toLocaleDateString()}.`,
    '',
    'Powered by Verola'
  ].join('\n');

  return {
    subject: isStaffInvite ? `Staff invite to ${invite.businessName}` : `Set up ${invite.businessName} on Verola`,
    body,
    url
  };
}

function inviteMailtoHref(invite: OrganisationInvite) {
  const { subject, body } = buildPersonalisedInviteMessage(invite);
  return `mailto:${encodeURIComponent(invite.adminEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function staffIdentityMatches(member: StaffMember, user: AuthUser) {
  const email = user.email.toLowerCase();
  const name = user.name.toLowerCase();
  return member.email?.toLowerCase() === email
    || member.phone.toLowerCase() === email
    || member.name.toLowerCase() === name;
}

function staffMemberFromAuth(user: AuthUser, businessId: string): StaffMember {
  return {
    businessId,
    name: user.name || user.email.split('@')[0] || 'Staff member',
    role: 'Staff',
    email: user.email,
    phone: user.email,
    active: true,
    clockedIn: false,
    hoursToday: 0,
    lastShift: 'New staff member'
  };
}

function staffUserIdFor(memberOrName: Pick<StaffMember, 'email' | 'phone' | 'name'> | string) {
  const raw = typeof memberOrName === 'string'
    ? memberOrName
    : memberOrName.email || memberOrName.phone || memberOrName.name;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'staff-member';
}

function rosterShiftBelongsToStaff(shift: RosterShift, member: StaffMember, user?: AuthUser | null) {
  const possibleIds = [
    staffUserIdFor(member),
    member.email ? staffUserIdFor(member.email) : '',
    member.phone ? staffUserIdFor(member.phone) : '',
    user?.email ? staffUserIdFor(user.email) : '',
    user?.name ? staffUserIdFor(user.name) : ''
  ].filter(Boolean);
  const comparableNames = [member.name, member.email, member.phone, user?.name, user?.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return Boolean(
    (shift.staffUserId && possibleIds.includes(shift.staffUserId))
    || comparableNames.includes(shift.staffName.toLowerCase())
  );
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
  const isInviteAcceptPath = isInvitePath(initialPath);
  const initialPortal = portalFromPath(initialPath);
  const [portal, setPortal] = useState<Portal>(() => portalFromPath(initialPath));
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readStoredValue<AuthUser | null>(authStorageKey, null));
  const [authReady, setAuthReady] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>(() => initialPortal);
  const [loginEmail, setLoginEmail] = useState(defaultEmailByRole[initialPortal]);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [copiedInviteId, setCopiedInviteId] = useState('');
  const [inviteSendingId, setInviteSendingId] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [inviteLookupPending, setInviteLookupPending] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>(() => readStoredArray(businessStorageKey, initialBusinesses));
  const [businessesLoading, setBusinessesLoading] = useState(Boolean(hasAppwriteConfig));
  const [activeBusinessId, setActiveBusinessId] = useState(() => readStoredValue(activeBusinessStorageKey, ''));
  const [jobs, setJobs] = useState<Job[]>(() => readStoredArray(jobsStorageKey, initialJobs));
  const [rosterShifts, setRosterShifts] = useState<RosterShift[]>(() => readStoredArray(rosterStorageKey, initialRosterShifts));
  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  const [newCustomer, setNewCustomer] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobNotes, setNewJobNotes] = useState('');
  const [newJobPaid, setNewJobPaid] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => readStoredArray(staffStorageKey, initialStaffMembers));
  const [staffInviteName, setStaffInviteName] = useState('');
  const [staffInviteEmail, setStaffInviteEmail] = useState('');
  const [staffInvitePhone, setStaffInvitePhone] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessContactName, setNewBusinessContactName] = useState('');
  const [newBusinessIndustry, setNewBusinessIndustry] = useState('');
  const [newBusinessLocation, setNewBusinessLocation] = useState('');
  const [newBusinessPhone, setNewBusinessPhone] = useState('');
  const [newBusinessAdminEmail, setNewBusinessAdminEmail] = useState('');
  const [createdUsers, setCreatedUsers] = useState<AuthUser[]>(() => readStoredArray(userStorageKey, []));
  const [setupDraft, setSetupDraft] = useState<SetupDraft>({ name: '', password: '', error: '' });
  const [organisationInvites, setOrganisationInvites] = useState<OrganisationInvite[]>(() => readStoredArray<OrganisationInvite>(inviteStorageKey, []).map((invite) => normalizeInvite(invite)));
  const [rosterStaff, setRosterStaff] = useState('');
  const [rosterDate, setRosterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rosterStart, setRosterStart] = useState('9:00 AM');
  const [rosterEnd, setRosterEnd] = useState('5:00 PM');
  const [rosterArea, setRosterArea] = useState('Front counter');
  const [workflowStages, setWorkflowStages] = useState<Record<JobStatus, WorkflowStage>>(() => readStoredValue(workflowStorageKey, defaultWorkflowStages));
  const [smsNotice, setSmsNotice] = useState('');
  const [workflowToast, setWorkflowToast] = useState<WorkflowToast | null>(null);
  const [rosterToast, setRosterToast] = useState<WorkflowToast | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [masterSmsSettings, setMasterSmsSettings] = useState<MasterSmsSettings>(() => readStoredValue(masterSmsStorageKey, defaultMasterSmsSettings));
  const [masterSmsDraft, setMasterSmsDraft] = useState<MasterSmsDraft>(() => ({
    provider: defaultMasterSmsSettings.provider,
    senderName: defaultMasterSmsSettings.senderName,
    apiKey: '',
    username: '',
    fromNumber: ''
  }));
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>(() => readStoredArray(smsLogsStorageKey, []));
  const [smsTemplates, setSmsTemplates] = useState<Record<JobStatus, string>>(() => readStoredValue(smsTemplateStorageKey, defaultSmsTemplates));
  const rosterActionSnapshotRef = useRef<Record<string, string>>({});
  const clockActionSnapshotRef = useRef<Record<string, string>>({});
  const sharedStateHydratedRef = useRef(false);

  const lockedBusinessId = authUser?.role === 'admin' || authUser?.role === 'staff' ? authUser.businessId : undefined;
  const resolvedBusinessId = lockedBusinessId ?? activeBusinessId;
  const activeBusiness = businesses.find((business) => business.id === resolvedBusinessId) ?? businesses[0] ?? platformFallbackBusiness;
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
  const activeStaffMembers = useMemo(
    () => staffMembers.filter((member) => member.active && (!member.businessId || member.businessId === activeBusiness.id)),
    [activeBusiness.id, staffMembers]
  );
  const selectedJob = visibleJobs.find((job) => job.id === selectedJobId);
  const inferredAdminUsers = businesses
    .filter((business) => business.adminEmail)
    .map((business) => ({
      email: business.adminEmail ?? '',
      name: business.contactName || `${business.name} Admin`,
      role: 'admin' as UserRole,
      businessId: business.id
    }));
  const loginUsers = [...platformUsers, ...createdUsers, ...inferredAdminUsers];
  const loginUser = loginUsers.find((candidate) => candidate.email === loginEmail.trim().toLowerCase() && candidate.role === loginRole);
  const loginBusinessByEmail = loginRole === 'admin' ? businesses.find((business) => business.adminEmail?.toLowerCase() === loginEmail.trim().toLowerCase()) : undefined;
  const loginBusiness = loginUser?.businessId ? businesses.find((business) => business.id === loginUser.businessId) : loginBusinessByEmail;
  const activeBrand = brandFromBusiness(activeBusiness);
  const currentStaffMember = useMemo(() => (
    authUser?.role === 'staff'
      ? activeStaffMembers.find((member) => staffIdentityMatches(member, authUser)) ?? staffMemberFromAuth(authUser, activeBusiness.id)
      : activeStaffMembers.find((member) => member.role === 'Staff') ?? activeStaffMembers[0] ?? staffMemberFromAuth({ email: '', name: 'Staff member', role: 'staff', businessId: activeBusiness.id }, activeBusiness.id)
  ), [activeBusiness.id, activeStaffMembers, authUser]);
  const loginBrand = loginRole === 'super' ? platformBrand : brandFromBusiness(loginBusiness);
  const canPreviewPortals = Boolean(authUser && (authUser.role === 'super' || import.meta.env.DEV || !hasAppwriteConfig));
  const visiblePortals = canPreviewPortals ? (Object.keys(portalMeta) as Portal[]) : authUser ? [authUser.role] : [];
  const activeInviteToken = inviteTokenFromPath(currentPath);
  const activeInvite = activeInviteToken
    ? (
      organisationInvites.find((invite) => invite.token === activeInviteToken)
      || organisationInvites.find((invite) => invite.id === activeInviteToken)
      || inviteFromUrl(activeInviteToken)
    )
    : undefined;
  const inviteBusiness = activeInvite ? businesses.find((business) => business.id === activeInvite.businessId) ?? businessFromInvite(activeInvite) : undefined;
  const customerTrackJobId = currentPath.match(/^\/track\/([^/]+)/)?.[1] ? decodeURIComponent(currentPath.match(/^\/track\/([^/]+)/)?.[1] ?? '') : '';
  const customerTrackJob = customerTrackJobId ? jobs.find((job) => job.id === customerTrackJobId) : undefined;
  const customerTrackBusiness = customerTrackJob ? businesses.find((business) => business.id === customerTrackJob.businessId) : undefined;

  const staffInviteIsResolved = (invite: OrganisationInvite) =>
    invite.role === 'staff'
    && (
      invite.status === 'accepted'
      || createdUsers.some((user) => user.role === 'staff' && user.businessId === invite.businessId && user.email.toLowerCase() === invite.adminEmail.toLowerCase())
      || staffMembers.some((member) =>
        member.businessId === invite.businessId
        && member.active
        && (
          member.email?.toLowerCase() === invite.adminEmail.toLowerCase()
          || (invite.phone && member.phone === invite.phone)
          || member.name.toLowerCase() === invite.contactName.toLowerCase()
        )
        && (
          member.lastShift !== 'Invite pending'
          || member.email?.toLowerCase() === invite.adminEmail.toLowerCase()
          || member.clockedIn
          || member.clockInAt
        )
      )
    );

  useEffect(() => {
    appwriteClient.ping().then(() => {
      console.log('[Appwrite] Connection verified — backend reachable');
    }).catch((err: unknown) => {
      console.warn('[Appwrite] Ping failed:', err);
    });
  }, []);

  useEffect(() => {
    if (portal !== 'staff') return;
    const staffName = currentStaffMember.name;
    if (!staffName) return;
    const viewedAt = nowLabel();
    setRosterShifts((current) =>
      current.map((shift) =>
        shift.businessId === activeBusiness.id && rosterShiftBelongsToStaff(shift, currentStaffMember, authUser) && shift.response === 'sent' && !shift.viewedAt
          ? { ...shift, viewedAt }
          : shift
      )
    );
  }, [portal, activeBusiness.id, authUser, currentStaffMember]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const storedUser = readStoredValue<AuthUser | null>(authStorageKey, null);
      const storedBusinessId = readStoredValue(activeBusinessStorageKey, '');

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
          debugPersistence('No Appwrite session cookie found; keeping remembered browser session if present');
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
    writeStoredArray(staffStorageKey, staffMembers);
  }, [staffMembers]);

  useEffect(() => {
    const invitedStaff = organisationInvites
      .filter((invite) => invite.role === 'staff' && invite.businessId === activeBusiness.id)
      .map((invite) => {
        const hasAcceptedAccount = invite.status === 'accepted'
          || createdUsers.some((user) => user.role === 'staff' && user.businessId === invite.businessId && user.email.toLowerCase() === invite.adminEmail.toLowerCase());
        return {
          businessId: invite.businessId,
          name: invite.contactName || invite.adminEmail.split('@')[0],
          role: 'Staff' as const,
          email: invite.adminEmail,
          phone: invite.phone || invite.adminEmail,
          active: inviteStatus(invite) !== 'expired',
          clockedIn: false,
          hoursToday: 0,
          lastShift: hasAcceptedAccount ? 'Account active' : 'Invite pending'
        };
      });

    if (!invitedStaff.length) return;

    setStaffMembers((current) => {
      let changed = false;
      const next = [...current];
      invitedStaff.forEach((member) => {
        const index = next.findIndex((item) => item.businessId === member.businessId && staffIdentityMatches(item, { email: member.email || member.phone, name: member.name, role: 'staff', businessId: member.businessId }));
        if (index === -1) {
          next.push(member);
          changed = true;
        } else {
          const shouldMarkActive = member.lastShift === 'Account active' && next[index].lastShift === 'Invite pending';
          const shouldFillIdentity = next[index].email !== member.email || next[index].phone !== member.phone;
          if (shouldMarkActive || shouldFillIdentity) {
            next[index] = {
              ...next[index],
              email: next[index].email || member.email,
              phone: next[index].phone || member.phone,
              active: true,
              lastShift: shouldMarkActive ? 'Account active' : next[index].lastShift
            };
            changed = true;
          }
        }
      });
      return changed ? next : current;
    });
  }, [activeBusiness.id, createdUsers, organisationInvites]);

  useEffect(() => {
    if (!hasAppwriteConfig || !appwriteDatabaseId || !activeBusiness?.id) return;
    let cancelled = false;

    const fetchRosterShifts = appwriteInviteFunctionId
      ? fetchRosterShiftsThroughFunction(activeBusiness.id).catch(() => fetchPersistedRosterShifts(activeBusiness.id))
      : fetchPersistedRosterShifts(activeBusiness.id);

    fetchRosterShifts
      .then((persistedShifts) => {
        if (cancelled || !persistedShifts.length) return;
        setRosterShifts((current) => [
          ...persistedShifts,
          ...current.filter((shift) => shift.businessId !== activeBusiness.id)
        ]);
        debugPersistence('roster shifts loaded', { businessId: activeBusiness.id, count: persistedShifts.length });
      })
      .catch((error) => {
        debugPersistence('roster shift fetch failed, using local fallback', error instanceof Error ? error.message : error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBusiness.id, authUser?.role]);

  useEffect(() => {
    if (!hasAppwriteConfig || !appwriteInviteFunctionId || !activeBusiness?.id) return;
    let cancelled = false;
    sharedStateHydratedRef.current = false;

    const refreshSharedOrganisationState = async () => {
      try {
        const [persistedInvites, clockStates, persistedShifts] = await Promise.all([
          fetchInvitesThroughFunction(activeBusiness.id),
          fetchStaffClockStatesThroughFunction(activeBusiness.id),
          fetchRosterShiftsThroughFunction(activeBusiness.id)
        ]);
        if (cancelled) return;
        const firstHydration = !sharedStateHydratedRef.current;

        if (persistedInvites.length) {
          setOrganisationInvites((current) => {
            const incomingIds = new Set(persistedInvites.map((invite) => invite.id));
            const untouched = current.filter((invite) => invite.businessId !== activeBusiness.id || !incomingIds.has(invite.id));
            return [...persistedInvites, ...untouched];
          });
        }
        if (persistedShifts.length) {
          const nextRosterSnapshot = Object.fromEntries(
            persistedShifts.map((shift) => [shift.id, `${shift.response}:${shift.respondedAt || shift.viewedAt || shift.sentAt || ''}`])
          );
          if (!firstHydration && (authUser?.role === 'admin' || authUser?.role === 'super')) {
            const changedShift = persistedShifts.find((shift) => {
              const previous = rosterActionSnapshotRef.current[shift.id];
              const next = nextRosterSnapshot[shift.id];
              return previous && previous !== next && (shift.response === 'accepted' || shift.response === 'declined');
            });
            if (changedShift) {
              showRosterToast(
                `${changedShift.staffName} ${changedShift.response} ${changedShift.start} roster`,
                changedShift.response === 'declined' ? 'warning' : 'success'
              );
            }
          }
          rosterActionSnapshotRef.current = nextRosterSnapshot;
          setRosterShifts((current) => [
            ...persistedShifts,
            ...current.filter((shift) => shift.businessId !== activeBusiness.id || persistedShifts.every((item) => item.id !== shift.id))
          ]);
        }
        if (clockStates.length) {
          const nextClockSnapshot = Object.fromEntries(
            clockStates.map((state) => [state.staffUserId, `${state.clockedIn ? 'in' : 'out'}:${state.clockInAt || ''}:${state.lastShift || ''}`])
          );
          if (!firstHydration && (authUser?.role === 'admin' || authUser?.role === 'super')) {
            const changedClock = clockStates.find((state) => {
              const previous = clockActionSnapshotRef.current[state.staffUserId];
              const next = nextClockSnapshot[state.staffUserId];
              return previous && previous !== next;
            });
            if (changedClock) {
              showRosterToast(
                changedClock.clockedIn
                  ? `${changedClock.staffName} clocked in`
                  : `${changedClock.staffName} clocked out`,
                'success'
              );
            }
          }
          clockActionSnapshotRef.current = nextClockSnapshot;
          setStaffMembers((current) => mergeStaffClockStates(current, clockStates, activeBusiness.id));
        }
        sharedStateHydratedRef.current = true;
      } catch (error) {
        debugPersistence('shared organisation state refresh failed', error instanceof Error ? error.message : error);
      }
    };

    refreshSharedOrganisationState();
    const interval = window.setInterval(refreshSharedOrganisationState, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeBusiness.id, authUser?.role]);

  useEffect(() => {
    writeStoredValue(workflowStorageKey, workflowStages);
  }, [workflowStages]);

  useEffect(() => {
    writeStoredValue(smsTemplateStorageKey, smsTemplates);
  }, [smsTemplates]);

  useEffect(() => {
    writeStoredValue(masterSmsStorageKey, masterSmsSettings);
  }, [masterSmsSettings]);

  useEffect(() => {
    writeStoredArray(smsLogsStorageKey, smsLogs);
  }, [smsLogs]);

  useEffect(() => {
    if (!workflowToast) return;
    const timeout = window.setTimeout(() => setWorkflowToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [workflowToast]);

  useEffect(() => {
    if (!rosterToast) return;
    const timeout = window.setTimeout(() => setRosterToast(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [rosterToast]);

  useEffect(() => {
    if (!activeStaffMembers.length) return;
    if (!activeStaffMembers.some((member) => member.name === rosterStaff)) {
      setRosterStaff(activeStaffMembers[0].name);
    }
  }, [activeStaffMembers, rosterStaff]);

  useEffect(() => {
    if (authUser?.role !== 'staff') return;
    const stillAllowed = activeStaffMembers.some((member) => member.active && staffIdentityMatches(member, authUser));
    if (!stillAllowed) {
      setAuthUser(null);
      setPortal('admin');
      setLoginRole('staff');
      setLoginEmail(authUser.email);
      setLoginError('Your staff access has been removed. Contact your business admin.');
      window.history.replaceState({}, '', '/login');
      setCurrentPath('/login');
    }
  }, [authUser, activeStaffMembers]);

  function showWorkflowToast(message: string, tone: WorkflowToast['tone'] = 'success') {
    setWorkflowToast({ id: Date.now(), tone, message });
  }

  function showRosterToast(message: string, tone: WorkflowToast['tone'] = 'success') {
    setRosterToast({ id: Date.now(), tone, message });
  }

  useEffect(() => {
    if (!activeInviteToken || activeInvite || !hasAppwriteConfig || !appwriteInviteFunctionId) return;

    let cancelled = false;
    // Determine if activeInviteToken looks like an invite ID (INV-...) or a hex token
    const isInviteId = /^INV-/.test(activeInviteToken) || (activeInviteToken.length < 40 && !/^[0-9a-f]{40,}$/i.test(activeInviteToken));
    const action = isInviteId ? 'lookup_invite_by_id' : 'lookup_invite';
    const body = isInviteId ? { action, inviteId: activeInviteToken } : { action, token: activeInviteToken };

    setInviteLookupPending(true);
    debugInvite('invite lookup requested', { token: activeInviteToken, action });
    functions.createExecution(
      appwriteInviteFunctionId,
      JSON.stringify(body),
      false, '/', ExecutionMethod.POST, { 'content-type': 'application/json' }
    )
      .then((execution) => {
        if (cancelled) return;
        const responseBody = (execution as { responseBody?: string }).responseBody;
        const payload = responseBody ? JSON.parse(responseBody) as { invite?: OrganisationInvite } : {};
        if (payload.invite) {
          const invite = normalizeInvite(payload.invite);
          setOrganisationInvites((current) => [invite, ...current.filter((item) => item.id !== invite.id && item.token !== invite.token)]);
          debugInvite('invite lookup success', { id: invite.id, token: invite.token, businessId: invite.businessId });
        } else {
          debugInvite('invite lookup failure', { token: activeInviteToken });
        }
      })
      .catch(() => debugInvite('invite lookup failure', { token: activeInviteToken }))
      .finally(() => {
        if (!cancelled) setInviteLookupPending(false);
      });

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
    if (hasAppwriteConfig && email && loginPassword.trim()) {
      try {
        await account.createEmailPasswordSession(email, loginPassword);
        const sessionUser = await account.get();
        const userWithMeta = sessionUser as typeof sessionUser & { labels?: string[]; prefs?: { role?: UserRole; businessId?: string; name?: string } };
        const matchedBusiness = businesses.find((business) => business.adminEmail?.toLowerCase() === sessionUser.email.toLowerCase());
        const matchedStaff = staffMembers.find((member) => member.email?.toLowerCase() === sessionUser.email.toLowerCase());
        const roleFromMeta = userWithMeta.prefs?.role
          || (userWithMeta.labels?.includes('super_admin') ? 'super' : userWithMeta.labels?.includes('staff') ? 'staff' : userWithMeta.labels?.includes('business_admin') ? 'admin' : undefined)
          || (matchedStaff ? 'staff' : matchedBusiness ? 'admin' : undefined);
        const businessId = userWithMeta.prefs?.businessId || matchedStaff?.businessId || matchedBusiness?.id;
        if (roleFromMeta === loginRole && (roleFromMeta === 'super' || businessId)) {
          const appwriteUser: AuthUser = {
            email: sessionUser.email,
            name: userWithMeta.prefs?.name || sessionUser.name || sessionUser.email,
            role: roleFromMeta,
            businessId
          };
          setAuthUser(appwriteUser);
          setLoginError('');
          setLoginPassword('');
          setPortal(appwriteUser.role);
          if (appwriteUser.businessId) setActiveBusinessId(appwriteUser.businessId);
          window.history.replaceState({}, '', portalPaths[appwriteUser.role]);
          setCurrentPath(portalPaths[appwriteUser.role]);
          debugPersistence('Appwrite session login succeeded', { email: appwriteUser.email, role: appwriteUser.role, businessId: appwriteUser.businessId });
          return;
        }
      } catch (error) {
        debugPersistence('Appwrite password login did not complete; falling back to assigned local account check', error instanceof Error ? error.message : error);
      }
    }

    const user = loginUsers.find((candidate) => candidate.email === email && candidate.role === loginRole);
    const passwordOk = user?.role === 'super' ? await passwordDigest(loginPassword) === platformOwnerPasswordHash : Boolean(loginPassword.trim());
    const organisationAvailable = !user?.businessId || businesses.some((business) => business.id === user.businessId && business.active);
    const staffAccessAllowed = user?.role !== 'staff'
      || staffMembers.some((member) =>
        member.businessId === user.businessId
        && member.active
        && staffIdentityMatches(member, user)
      );

    if (!user || !passwordOk || !organisationAvailable || !staffAccessAllowed) {
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
    if (hasAppwriteConfig) {
      account.deleteSession('current').catch((error) => {
        debugPersistence('Appwrite logout skipped', error instanceof Error ? error.message : error);
      });
    }
    setAuthUser(null);
    writeStoredValue(authStorageKey, null);
    setPortal('admin');
    setLoginRole('admin');
    setLoginEmail(defaultEmailByRole.admin);
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
    const inviteBusiness = businesses.find((business) => business.id === invite.businessId);

    setInviteSendingId(invite.id);
    setInviteNotice('');

    try {
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        const execution = await functions.createExecution(
          appwriteInviteFunctionId,
          JSON.stringify({
            action: 'send_invite',
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
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
            logoUrl: inviteBusiness?.logoUrl,
            businessDetails: inviteBusiness ? organisationPayloadFromBusiness(inviteBusiness) : undefined
          }),
          false,
          '/',
          ExecutionMethod.POST,
          { 'content-type': 'application/json' }
        );
        const result = execution as { responseStatusCode?: number; responseBody?: string; status?: string };
        const payload = result.responseBody ? JSON.parse(result.responseBody) as { emailSent?: boolean; emailConfigured?: boolean; error?: string; emailError?: string } : {};
        if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
          throw new Error(payload.error || 'Invite email could not be sent.');
        }
        if (!payload.emailSent) {
          throw new Error(payload.emailError || 'Invite email could not be sent via Appwrite.');
        }
        setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email sent just now' } : item)));
        setInviteNotice(`Invite email sent to ${invite.adminEmail}.`);
        debugInvite('invite email sent', { token: invite.token, businessId: invite.businessId });
        return;
      }

      setInviteNotice('Email sending is not configured. Configure the Appwrite invite function before sending invites.');
      debugInvite('email sending unavailable', { token: invite.token, businessId: invite.businessId });
    } catch (error) {
      setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email failed' } : item)));
      setInviteNotice(`Invite email could not be sent.${error instanceof Error ? ` ${error.message}` : ''}`);
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
    const invite = organisationInvites.find((item) => item.token === inviteToken)
      || organisationInvites.find((item) => item.id === inviteToken)
      || inviteFromUrl(inviteToken);
    if (!invite) return;

    const status = inviteStatus(invite);
    const adminName = setupDraft.name.trim();
    const password = setupDraft.password.trim();

    debugInvite(status === 'pending' ? 'invite accept started' : 'invite accept blocked', {
      id: invite.id, token: invite.token, businessId: invite.businessId, status
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
      // Step 1: Create Appwrite session via magic URL params if present
      const urlParams = new URLSearchParams(window.location.search);
      const magicUserId = urlParams.get('userId');
      const magicSecret = urlParams.get('secret');

      if (hasAppwriteConfig && magicUserId && magicSecret) {
        try {
          // createSession works for magic-url tokens (and all token types) per Appwrite SDK docs
          await account.createSession(magicUserId, magicSecret);
          await account.updateName(adminName);
          await account.updatePassword(password);
          debugInvite('appwrite magic URL session created', { userId: magicUserId });
        } catch (sessionError) {
          debugInvite('magic URL session failed, continuing with local setup', {
            error: sessionError instanceof Error ? sessionError.message : sessionError
          });
        }
      }

      // Step 2: Accept invite via function (creates/links Appwrite user, marks accepted)
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        const execution = await functions.createExecution(
          appwriteInviteFunctionId,
          JSON.stringify({
            action: 'accept_invite',
            inviteId: invite.id,
            token: invite.token,
            adminName,
            adminEmail: invite.adminEmail,
            password,
            businessId: invite.businessId
          }),
          false, '/', ExecutionMethod.POST, { 'content-type': 'application/json' }
        );
        const result = execution as { responseStatusCode?: number; responseBody?: string };
        const payload = result.responseBody ? JSON.parse(result.responseBody) as { accepted?: boolean; error?: string } : {};
        if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.error) {
          throw new Error(payload.error || 'Invite setup function failed.');
        }
      }
    } catch (error) {
      debugInvite('invite accept error', {
        id: invite.id, error: error instanceof Error ? error.message : error
      });
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        setSetupDraft((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Setup could not be completed. Please ask for a new invite.'
        }));
        return;
      }
    }

    // Local state update (always runs even if Appwrite calls fail)
    setOrganisationInvites((current) => {
      const exists = current.some((item) => item.id === invite.id || item.token === invite.token);
      if (exists) return current.map((item) =>
        (item.id === invite.id || item.token === invite.token)
          ? { ...item, status: 'accepted', acceptedAt: new Date().toISOString() }
          : item
      );
      return [{ ...invite, status: 'accepted', sentAt: 'Accepted from invite link' }, ...current];
    });
    setBusinesses((current) => (current.some((business) => business.id === invite.businessId) ? current : [businessFromInvite(invite), ...current]));
    const userRole: UserRole = invite.role === 'staff' ? 'staff' : 'admin';
    const user: AuthUser = { email: invite.adminEmail, name: adminName, role: userRole, businessId: invite.businessId };
    setCreatedUsers((current) => [user, ...current.filter((candidate) => candidate.email !== user.email)]);
    if (invite.role === 'staff') {
      setStaffMembers((current) => {
        const exists = current.some((member) => member.phone === invite.phone || member.name.toLowerCase() === adminName.toLowerCase());
        if (exists) return current.map((member) => (
          member.phone === invite.phone || member.name.toLowerCase() === adminName.toLowerCase()
            ? { ...member, name: adminName, phone: invite.phone || member.phone, active: true }
            : member
        ));
        return [
          { businessId: invite.businessId, name: adminName, role: 'Staff', email: invite.adminEmail, phone: invite.phone || invite.adminEmail, active: true, clockedIn: false, hoursToday: 0, lastShift: 'New staff member' },
          ...current
        ];
      });
    }
    setAuthUser(user);
    setActiveBusinessId(invite.businessId);
    setPortal(userRole);
    setLoginError('');
    setSetupDraft({ name: '', password: '', error: '' });
    debugInvite('invite accepted and account linked', { id: invite.id, businessId: invite.businessId, email: invite.adminEmail });
    window.history.replaceState({}, '', portalPaths[userRole]);
    setCurrentPath(portalPaths[userRole]);
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
      if (!(await saveOrganisationThroughFunction(business))) {
        await persistBusinessDocument(business);
      }
      debugPersistence('business created and persisted', { businessId: business.id, name: business.name });
    } catch (error) {
      debugPersistence('business create persistence failed, local fallback active', error instanceof Error ? error.message : error);
      setBusinesses((current) => current.filter((item) => item.id !== business.id));
      setInviteNotice(error instanceof Error ? `Business could not be saved permanently: ${error.message}` : 'Business could not be saved permanently.');
      return;
    }
    if (business.adminEmail) {
      setOrganisationInvites((current) => [invite, ...current]);
    }
    const preset = industryPresetFor(business.industry);
    setWorkflowStages(cloneWorkflowStages(preset.stages));
    setSmsTemplates(cloneSmsTemplates(preset.templates));
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

  async function inviteStaffMember() {
    const name = staffInviteName.trim();
    const email = staffInviteEmail.trim().toLowerCase();
    const phone = staffInvitePhone.trim();
    if (!name || !email) {
      setInviteNotice('Add the staff member name and email before sending an invite.');
      return;
    }

    const now = new Date();
    const invite: OrganisationInvite = {
      id: `STAFF-INV-${Date.now()}`,
      token: generateInviteToken(),
      businessId: activeBusiness.id,
      businessName: activeBusiness.name,
      contactName: name,
      adminEmail: email,
      phone,
      role: 'staff',
      status: 'pending',
      sentAt: 'Staff invite created',
      createdAt: now.toISOString(),
      expiresAt: addDays(now, 14)
    };

    setOrganisationInvites((current) => [invite, ...current]);
    setStaffMembers((current) => {
      const exists = current.some((member) => member.phone === phone || member.name.toLowerCase() === name.toLowerCase());
      if (exists) return current;
      return [
        { businessId: activeBusiness.id, name, role: 'Staff', email, phone: phone || email, active: true, clockedIn: false, hoursToday: 0, lastShift: 'Invite pending' },
        ...current
      ];
    });
    setRosterStaff(name);
    setStaffInviteName('');
    setStaffInviteEmail('');
    setStaffInvitePhone('');
    debugInvite('staff invite token created', { token: invite.token, businessId: invite.businessId, email: invite.adminEmail, expiresAt: invite.expiresAt });
    debugInvite('staff invite URL generated', { token: invite.token, url: buildInviteUrl(invite) });
    await sendInviteEmailForInvite(invite);
  }

  function removeStaffMember(member: StaffMember) {
    const memberId = staffUserIdFor(member);
    setStaffMembers((current) =>
      current.filter((item) =>
        !(
          item.businessId === activeBusiness.id
          && (
            staffUserIdFor(item) === memberId
            || (member.email && item.email?.toLowerCase() === member.email.toLowerCase())
            || item.name.toLowerCase() === member.name.toLowerCase()
          )
        )
      )
    );
    setCreatedUsers((current) =>
      current.filter((user) =>
        !(
          user.role === 'staff'
          && user.businessId === activeBusiness.id
          && (
            user.email.toLowerCase() === member.email?.toLowerCase()
            || user.name.toLowerCase() === member.name.toLowerCase()
          )
        )
      )
    );
    setOrganisationInvites((current) =>
      current.map((invite) =>
        invite.role === 'staff'
        && invite.businessId === activeBusiness.id
        && (
          invite.adminEmail.toLowerCase() === member.email?.toLowerCase()
          || invite.contactName.toLowerCase() === member.name.toLowerCase()
        )
          ? { ...invite, status: 'expired', sentAt: 'Access removed' }
          : invite
      )
    );
    setRosterShifts((current) =>
      current.filter((shift) =>
        !(
          shift.businessId === activeBusiness.id
          && (
            shift.staffUserId === memberId
            || shift.staffName.toLowerCase() === member.name.toLowerCase()
          )
        )
      )
    );
    setSmsNotice(`${member.name} was removed from ${activeBusiness.name}.`);
    showRosterToast(`${member.name} access removed`, 'warning');
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
      const savedBranding = await saveBrandingThroughFunction(businessId, file, logoUrl);
      if (savedBranding) {
        logoUrl = savedBranding.logoUrl || logoUrl;
        logoFileId = savedBranding.logoFileId;
        debugPersistence('branding saved through function', { businessId, logoFileId });
      } else if (hasAppwriteConfig && appwriteLogoBucketId) {
        const uploadedFile = await storage.createFile(appwriteLogoBucketId, ID.unique(), file);
        logoFileId = uploadedFile.$id;
        logoUrl = logoViewUrl(logoFileId) || logoUrl;
        debugPersistence('logo uploaded', { businessId, fileId: logoFileId, fileName: file.name });
        debugPersistence('logo URL generated', { businessId, logoUrl });
      }
    } catch (error) {
      debugPersistence('logo persistence failed before local preview', error instanceof Error ? error.message : error);
      setInviteNotice(error instanceof Error ? `Logo could not be saved permanently: ${error.message}` : 'Logo could not be saved permanently.');
      return;
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
      if (logoFileId || (await patchBusinessDocument(businessId, patch))) {
        const persistedBusinesses = await fetchPersistedBusinesses();
        if (persistedBusinesses.length) setBusinesses(persistedBusinesses);
        debugPersistence('branding saved', { businessId, logoFileId });
      }
      setInviteNotice('Logo saved. It will appear across this organisation portal.');
    } catch (error) {
      debugPersistence('branding save failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice(error instanceof Error ? `Logo saved, but refresh verification failed: ${error.message}` : 'Logo saved, but refresh verification failed.');
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
      const removedThroughFunction = await removeBrandingThroughFunction(businessId, currentBusiness?.logoFileId);
      if (removedThroughFunction) {
        debugPersistence('branding removed through function', { businessId });
      } else if (currentBusiness?.logoFileId && appwriteLogoBucketId) {
        await storage.deleteFile(appwriteLogoBucketId, currentBusiness.logoFileId);
      }
      if (removedThroughFunction || await patchBusinessDocument(businessId, { logoName: undefined, logoUrl: undefined, logoFileId: undefined })) {
        debugPersistence('branding saved', { businessId, logoRemoved: true });
      }
      setInviteNotice('Logo removed. This business now uses the Verola fallback mark.');
    } catch (error) {
      debugPersistence('logo remove persistence failed, local fallback active', error instanceof Error ? error.message : error);
      setInviteNotice('Logo removed locally. Appwrite persistence needs database/storage permissions.');
    }
  }

  function updateMasterSmsDraft(patch: Partial<MasterSmsDraft>) {
    setMasterSmsDraft((draft) => ({ ...draft, ...patch }));
  }

  function saveMasterSmsProvider() {
    if (!masterSmsDraft.apiKey.trim()) {
      setMasterSmsSettings((settings) => ({ ...settings, status: 'failed' }));
      setSmsNotice('Master SMS setup failed. Add the provider API key before saving.');
      return;
    }

    const cleanSender = masterSmsDraft.senderName.trim() || 'VEROLA';
    const preview = masterSmsDraft.apiKey.length <= 4 ? '••••' : `...${masterSmsDraft.apiKey.slice(-4)}`;
    setMasterSmsSettings({
      provider: masterSmsDraft.provider,
      senderName: cleanSender,
      status: 'connected',
      maskedKeyPreview: preview,
      lastTestedAt: 'Just now'
    });
    setMasterSmsDraft((draft) => ({ ...draft, senderName: cleanSender, apiKey: '', username: '', fromNumber: '' }));
    setSmsNotice(`${providerName(masterSmsDraft.provider)} is now the platform master SMS provider. API keys are not stored in browser state.`);
  }

  function disconnectMasterSmsProvider() {
    setMasterSmsSettings({ ...defaultMasterSmsSettings });
    setSmsNotice('Master SMS provider disconnected. Job statuses still update, but customer SMS is unavailable for every business.');
  }

  function testMasterSmsProvider() {
    if (masterSmsSettings.status === 'connected') {
      setMasterSmsSettings((settings) => ({ ...settings, lastTestedAt: 'Just now' }));
      setSmsNotice(`${providerName(masterSmsSettings.provider)} master SMS connection test passed.`);
      return;
    }
    if (!masterSmsDraft.apiKey.trim()) {
      setMasterSmsSettings((settings) => ({ ...settings, status: 'failed' }));
      setSmsNotice('Test failed. Add provider credentials in Super Admin before testing.');
      return;
    }
    setSmsNotice(`${providerName(masterSmsDraft.provider)} test passed. Save the provider to enable platform SMS.`);
  }

  async function sendTestSms() {
    const connected = masterSmsSettings.status === 'connected' && Boolean(appwriteSmsFunctionId);
    let providerResponse = connected ? 'Test SMS queued through master provider.' : 'Master SMS provider function is not configured.';
    if (connected && appwriteSmsFunctionId) {
      try {
        const execution = await functions.createExecution(
          appwriteSmsFunctionId,
          JSON.stringify({
            action: 'send_test_sms',
            organisationId: activeBusiness.id,
            businessName: activeBusiness.name,
            provider: masterSmsSettings.provider,
            senderName: masterSmsSettings.senderName
          }),
          false,
          '/',
          ExecutionMethod.POST,
          { 'content-type': 'application/json' }
        );
        const result = execution as { responseStatusCode?: number; responseBody?: string };
        const payload = result.responseBody ? JSON.parse(result.responseBody) as { ok?: boolean; status?: 'sent' | 'failed'; providerMessageId?: string; error?: string } : {};
        if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.ok === false || payload.status === 'failed') {
          throw new Error(payload.error || 'SMS function returned a failure.');
        }
        providerResponse = payload.providerMessageId ? `Queued by provider as ${payload.providerMessageId}` : 'Test SMS queued through master provider.';
      } catch (error) {
        providerResponse = error instanceof Error ? error.message : 'Test SMS failed.';
      }
    }
    const sent = connected && !providerResponse.toLowerCase().includes('failed') && !providerResponse.toLowerCase().includes('not configured') && !providerResponse.toLowerCase().includes('error');
    setSmsLogs((logs) => [
      {
        id: `sms-${Date.now()}`,
        businessId: activeBusiness.id,
        businessName: activeBusiness.name,
        recipient: 'test recipient',
        templateKey: 'test',
        status: sent ? 'sent' : 'failed',
        timestamp: 'Just now',
        provider: masterSmsSettings.provider,
        response: providerResponse
      },
      ...logs
    ]);
    setSmsNotice(sent ? 'Test SMS queued through the platform master provider.' : 'SMS unavailable. Configure the secure Appwrite SMS function before sending customer messages.');
  }

  async function sendCustomerSms(job: Job, status: JobStatus, message: string) {
    if (masterSmsSettings.status !== 'connected') {
      return { sent: false, response: 'Master SMS provider is not connected.' };
    }
    if (!appwriteSmsFunctionId) {
      return { sent: false, response: 'Secure SMS function is not configured.' };
    }
    try {
      const execution = await functions.createExecution(
        appwriteSmsFunctionId,
        JSON.stringify({
          action: 'send_sms',
          organisationId: activeBusiness.id,
          businessName: activeBusiness.name,
          jobId: job.id,
          customerName: job.customer,
          phoneNumber: job.phone,
          messageBody: message,
          templateKey: status,
          provider: masterSmsSettings.provider,
          senderName: masterSmsSettings.senderName
        }),
        false,
        '/',
        ExecutionMethod.POST,
        { 'content-type': 'application/json' }
      );
      const result = execution as { responseStatusCode?: number; responseBody?: string };
      const payload = result.responseBody ? JSON.parse(result.responseBody) as { ok?: boolean; status?: 'sent' | 'failed'; providerMessageId?: string; error?: string } : {};
      if ((result.responseStatusCode && result.responseStatusCode >= 400) || payload.ok === false || payload.status === 'failed') {
        throw new Error(payload.error || 'SMS function returned a failure.');
      }
      return { sent: true, response: payload.providerMessageId ? `Provider message ${payload.providerMessageId}` : `Queued by ${masterSmsSettings.senderName || 'VEROLA'}` };
    } catch (error) {
      return { sent: false, response: error instanceof Error ? error.message : 'SMS function failed.' };
    }
  }

  async function updateJobStatus(jobId: string, status: JobStatus) {
    const actionTime = nowLabel();
    const targetJob = jobs.find((item) => item.id === jobId);
    if (!targetJob) return;
    const message = smsTemplates[status]
      .replace('{{customer}}', targetJob.customer.split(' ')[0])
      .replace('{{business}}', activeBusiness.name);
    const smsResult = await sendCustomerSms(targetJob, status, message);

    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) return job;

        return {
          ...job,
          status,
          updates: [
            {
              status,
              at: actionTime,
              kind: smsResult.sent ? 'sms' : 'sms_failed',
              sms: smsResult.sent ? `Customer SMS sent: ${message}` : `SMS failed. Status updated, but no customer message was sent. ${smsResult.response}`
            },
            ...job.updates
          ]
        };
      })
    );

    setSmsLogs((logs) => [
      {
        id: `sms-${Date.now()}`,
        businessId: activeBusiness.id,
        businessName: activeBusiness.name,
        recipient: targetJob.phone,
        templateKey: status,
        status: smsResult.sent ? 'sent' : 'failed',
        timestamp: actionTime,
        provider: masterSmsSettings.provider,
        response: smsResult.response
      },
      ...logs
    ]);
    if (smsResult.sent) {
      setSmsNotice(status === 'completed' ? 'Order completed and saved.' : `Customer notified: ${targetJob.customer}.`);
      showWorkflowToast(status === 'completed' ? 'Order completed and saved' : 'Customer notified');
    } else {
      setSmsNotice(status === 'completed' ? 'Order completed and saved. SMS failed.' : 'SMS failed. Status updated, but no customer message was sent.');
      showWorkflowToast(status === 'completed' ? 'Order completed and saved' : 'SMS failed', status === 'completed' ? 'success' : 'warning');
    }
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
      paid: newJobPaid,
      paidAt: newJobPaid ? 'Just now' : undefined,
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
    setNewJobPaid(false);
    setSmsNotice('Job created. Move it through the workflow to preview customer updates.');
  }

  function addRosterShift() {
    if (!rosterStaff || !rosterDate.trim() || !rosterStart.trim() || !rosterEnd.trim() || !rosterArea.trim()) return;

    const selectedStaff = activeStaffMembers.find((member) => member.name === rosterStaff)
      ?? staffMembers.find((member) => member.name === rosterStaff);
    const staffRole = selectedStaff?.role ?? 'Staff';
    const shift: RosterShift = {
      id: ID.unique(),
      businessId: activeBusiness.id,
      staffUserId: selectedStaff ? staffUserIdFor(selectedStaff) : staffUserIdFor(rosterStaff),
      staffName: rosterStaff,
      role: staffRole,
      date: rosterDate.trim(),
      start: rosterStart.trim(),
      end: rosterEnd.trim(),
      area: rosterArea.trim(),
      response: 'sent',
      sentAt: nowLabel()
    };

    setRosterShifts((current) => [shift, ...current]);
    setSmsNotice(`Shift sent to ${shift.staffName} for ${formatRosterDate(shift.date)}, ${shift.start} to ${shift.end}.`);
    showRosterToast(`Shift sent to ${shift.staffName}`);
    const persistShift = appwriteInviteFunctionId
      ? patchRosterShiftThroughFunction(shift).catch(() => persistRosterShift(shift, authUser?.email || 'business_admin'))
      : persistRosterShift(shift, authUser?.email || 'business_admin');
    persistShift.catch((error) => {
      console.warn('[Roster] Persist shift failed:', error);
    });
  }

  function updateRosterResponse(shiftId: string, response: ShiftResponse) {
    const shift = rosterShifts.find((item) => item.id === shiftId);
    const respondedAt = nowLabel();
    const updatedShift = shift ? { ...shift, response, respondedAt, viewedAt: shift.viewedAt || respondedAt } : undefined;
    setRosterShifts((current) => current.map((item) => (item.id === shiftId ? { ...item, response, respondedAt, viewedAt: item.viewedAt || respondedAt } : item)));
    const message = shift
      ? response === 'accepted'
        ? `${shift.staffName} accepted ${shift.start} roster`
        : response === 'declined'
          ? `${shift.staffName} declined ${shift.start} roster`
          : 'Roster updated.'
      : 'Roster updated.';
    setSmsNotice(message);
    showRosterToast(message, response === 'declined' ? 'warning' : 'success');
    if (updatedShift) {
      const persistResponse = appwriteInviteFunctionId
        ? patchRosterShiftThroughFunction(updatedShift).catch(() => patchRosterShift(updatedShift))
        : patchRosterShift(updatedShift);
      persistResponse.catch((error) => {
        console.warn('[Roster] Persist response failed:', error);
      });
    }
  }

  function deleteRosterShift(shiftId: string) {
    const shift = rosterShifts.find((item) => item.id === shiftId);
    setRosterShifts((current) => current.filter((item) => item.id !== shiftId));
    setSmsNotice(shift ? `Deleted ${shift.staffName}'s shift for ${formatRosterDate(shift.date)}.` : 'Shift deleted.');
    deletePersistedRosterShift(shiftId).catch((error) => {
      console.warn('[Roster] Delete persisted shift failed:', error);
    });
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

  function toggleStaffClock(staffMember: StaffMember) {
    const name = staffMember.name;
    const member = staffMembers.find((item) => staffIdentityMatches(item, { email: staffMember.email || staffMember.phone, name, role: 'staff', businessId: activeBusiness.id }) && (!item.businessId || item.businessId === activeBusiness.id))
      ?? staffMember;
    const clockingOut = Boolean(member.clockedIn);
    const actionAt = nowLabel();
    setStaffMembers((members) =>
      (members.some((item) => staffIdentityMatches(item, { email: member.email || member.phone, name, role: 'staff', businessId: activeBusiness.id }) && (!item.businessId || item.businessId === activeBusiness.id))
        ? members
        : [member, ...members]
      ).map((item) =>
        staffIdentityMatches(item, { email: member.email || member.phone, name, role: 'staff', businessId: activeBusiness.id }) && (!item.businessId || item.businessId === activeBusiness.id)
          ? {
              ...item,
              clockedIn: !member.clockedIn,
              clockInAt: member.clockedIn ? undefined : actionAt,
              hoursToday: member.clockedIn ? Math.max(member.hoursToday, 6.4) : member.hoursToday
            }
          : item
      )
    );
    const message = clockingOut ? `${name} clocked out at ${actionAt}` : `${name} clocked in at ${actionAt}`;
    setSmsNotice(message);
    showRosterToast(message);
    persistStaffClockThroughFunction(member, activeBusiness.id, clockingOut)
      .catch(() => persistStaffClock(member, activeBusiness.id, clockingOut))
      .catch((error) => {
        console.warn('[Staff clock] Persist clock event failed:', error);
      });
  }

  if (activeInviteToken) {
    return (
      <BrandProvider brand={brandFromBusiness(inviteBusiness)}>
        <InviteAcceptView
          invite={activeInvite}
          lookupPending={inviteLookupPending}
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
        <CustomerStatusView job={customerTrackJob} business={customerTrackBusiness} workflowStages={workflowStages} />
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
            masterSmsSettings={masterSmsSettings}
            masterSmsDraft={masterSmsDraft}
            updateMasterSmsDraft={updateMasterSmsDraft}
            saveMasterSmsProvider={saveMasterSmsProvider}
            testMasterSmsProvider={testMasterSmsProvider}
            disconnectMasterSmsProvider={disconnectMasterSmsProvider}
            smsLogs={smsLogs}
            smsNotice={smsNotice}
          />
        )}

        {portal === 'admin' && (
          <BusinessAdminView
            business={activeBusiness}
            jobs={visibleJobs}
            staff={activeStaffMembers}
            rosterShifts={activeRosterShifts}
            rosterToast={rosterToast}
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
            applyIndustryPreset={(presetKey) => {
              const preset = presetKey ? industryPresets[presetKey] : industryPresetFor(activeBusiness.industry);
              setWorkflowStages(cloneWorkflowStages(preset.stages));
              setSmsTemplates(cloneSmsTemplates(preset.templates));
              setSmsNotice(`${preset.label} workflow and SMS templates applied for ${activeBusiness.name}.`);
            }}
            smsNotice={smsNotice}
            workflowToast={workflowToast}
            masterSmsSettings={masterSmsSettings}
            sendTestSms={sendTestSms}
            smsLogs={smsLogs.filter((log) => log.businessId === activeBusiness.id)}
            smsTemplates={smsTemplates}
            setSmsTemplate={(status, body) => setSmsTemplates((templates) => ({ ...templates, [status]: body }))}
            newCustomer={newCustomer}
            setNewCustomer={setNewCustomer}
            newPhone={newPhone}
            setNewPhone={setNewPhone}
            newJobNotes={newJobNotes}
            setNewJobNotes={setNewJobNotes}
            newJobPaid={newJobPaid}
            setNewJobPaid={setNewJobPaid}
            addJob={addJob}
            staffInviteName={staffInviteName}
            setStaffInviteName={setStaffInviteName}
            staffInviteEmail={staffInviteEmail}
            setStaffInviteEmail={setStaffInviteEmail}
            staffInvitePhone={staffInvitePhone}
            setStaffInvitePhone={setStaffInvitePhone}
            inviteStaffMember={inviteStaffMember}
            staffInvites={organisationInvites.filter((invite) => invite.businessId === activeBusiness.id && invite.role === 'staff' && !staffInviteIsResolved(invite))}
            removeStaffMember={removeStaffMember}
            copiedInviteId={copiedInviteId}
            inviteSendingId={inviteSendingId}
            inviteNotice={inviteNotice}
            copyInviteLink={copyInviteLink}
            sendInviteEmail={sendInviteEmail}
          />
        )}

        {portal === 'staff' && (
          <StaffView
            business={activeBusiness}
            jobs={visibleJobs}
            selectedJob={selectedJob}
            setSelectedJobId={setSelectedJobId}
            toggleJobPaid={toggleJobPaid}
            workflowStages={workflowStages}
            query={query}
            setQuery={setQuery}
            staffMember={currentStaffMember}
            rosterShifts={activeRosterShifts.filter((shift) => rosterShiftBelongsToStaff(shift, currentStaffMember, authUser))}
            rosterToast={rosterToast}
            updateRosterResponse={updateRosterResponse}
            toggleClock={() => toggleStaffClock(currentStaffMember)}
          />
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
  masterSmsSettings,
  masterSmsDraft,
  updateMasterSmsDraft,
  saveMasterSmsProvider,
  testMasterSmsProvider,
  disconnectMasterSmsProvider,
  smsLogs,
  smsNotice
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
  masterSmsSettings: MasterSmsSettings;
  masterSmsDraft: MasterSmsDraft;
  updateMasterSmsDraft: (patch: Partial<MasterSmsDraft>) => void;
  saveMasterSmsProvider: () => void;
  testMasterSmsProvider: () => void;
  disconnectMasterSmsProvider: () => void;
  smsLogs: SmsLog[];
  smsNotice: string;
}) {
  const activeTenants = tenants.filter((tenant) => tenant.active).length;
  const pendingBusinessInvites = organisationInvites.filter((invite) => invite.role === 'business_admin' && inviteStatus(invite) === 'pending');
  const activeBusinessInvites = organisationInvites.filter((invite) => invite.role === 'business_admin' && invite.businessId === activeBusiness.id);
  const totalSmsSent = smsLogs.filter((log) => log.status === 'sent').length;

  return (
    <div className="super-console">
      <section className="super-hero panel">
        <div>
          <span className="eyebrow">Verola Control Centre</span>
          <h2>Manage tenant setup without the noise.</h2>
          <p>Create organisations, upload branding, send setup invites, and keep platform messaging healthy from one clean workspace.</p>
        </div>
        <div className="super-health-grid">
          <div><strong>{tenants.length}</strong><span>Businesses</span></div>
          <div><strong>{pendingBusinessInvites.length}</strong><span>Pending invites</span></div>
          <div><strong>{masterSmsSettings.status === 'connected' ? 'Live' : 'Off'}</strong><span>SMS</span></div>
          <div><strong>{totalSmsSent}</strong><span>Sent SMS</span></div>
        </div>
      </section>

      <section className="super-main-grid">
        <div className="super-main-column">
          <section className="panel super-business-panel">
            <PanelHeader icon={Building2} title="Businesses" action={businessesLoading ? 'Syncing' : `${activeTenants} active`} />
            <div className="business-create-form super-create-compact">
              <input value={newBusinessName} onChange={(event) => setNewBusinessName(event.target.value)} placeholder="Business name" />
              <input value={newBusinessContactName} onChange={(event) => setNewBusinessContactName(event.target.value)} placeholder="Contact name" />
              <input value={newBusinessAdminEmail} onChange={(event) => setNewBusinessAdminEmail(event.target.value)} placeholder="Admin email" type="email" />
              <input value={newBusinessIndustry} onChange={(event) => setNewBusinessIndustry(event.target.value)} placeholder="Industry" />
              <input value={newBusinessLocation} onChange={(event) => setNewBusinessLocation(event.target.value)} placeholder="Location" />
              <input value={newBusinessPhone} onChange={(event) => setNewBusinessPhone(event.target.value)} placeholder="Phone" />
              <button onClick={addBusiness} disabled={!newBusinessName.trim() || !newBusinessAdminEmail.trim()}>
                <Send size={17} />
                Create & send setup invite
              </button>
            </div>
            {inviteNotice && <div className="inline-notice">{inviteNotice}</div>}

            <div className="tenant-list premium-tenant-list super-tenant-list">
              {tenants.map((tenant) => {
                const pendingInvite = organisationInvites.find((invite) => invite.role === 'business_admin' && invite.businessId === tenant.id && inviteStatus(invite) === 'pending');
                return (
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
                      <small>{tenant.adminEmail || 'No admin email yet'}</small>
                    </div>
                    <div className="tenant-actions">
                      <div className="tenant-meta">
                        <span className={tenant.active ? 'status-dot active' : 'status-dot paused'}>{tenant.active ? 'Active' : 'Disabled'}</span>
                        {pendingInvite && <span className="status-dot pending">Invite pending</span>}
                      </div>
                      <details className="tenant-menu" onClick={(event) => event.stopPropagation()}>
                        <summary aria-label={`Actions for ${tenant.name}`}>•••</summary>
                        {pendingInvite && (
                          <button onClick={() => sendInviteEmail(pendingInvite.id)} disabled={inviteSendingId === pendingInvite.id}>
                            {inviteSendingId === pendingInvite.id ? 'Sending...' : 'Resend invite'}
                          </button>
                        )}
                        {pendingInvite && <button onClick={() => copyInviteLink(pendingInvite.id)}>{copiedInviteId === pendingInvite.id ? 'Copied' : 'Copy invite'}</button>}
                        <button disabled={tenants.length <= 1} onClick={() => deleteBusiness(tenant.id)}>Delete business</button>
                      </details>
                    </div>
                    <ChevronRight size={18} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="super-side-column">
          <section className="panel selected-business-card" style={{ '--brand': activeBusiness.primary, '--accent': activeBusiness.accent } as React.CSSProperties}>
            <div className="selected-business-top">
              <BusinessLogo business={activeBusiness} className="preview-logo" />
              <div>
                <span className="eyebrow">Selected business</span>
                <h2>{activeBusiness.name}</h2>
                <p>{activeBusiness.industry} · {activeBusiness.location}</p>
              </div>
            </div>
            <div className="selected-business-actions">
              <label className="logo-upload">
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(event) => uploadBusinessLogo(activeBusiness.id, event.target.files?.[0])} />
                <Paintbrush size={17} />
                {activeBusiness.logoUrl ? 'Replace logo' : 'Upload logo'}
              </label>
              <button className="secondary-action" onClick={() => removeBusinessLogo(activeBusiness.id)} disabled={!activeBusiness.logoUrl}>
                <X size={16} />
                Remove
              </button>
            </div>
            <div className="brand-colour-controls compact">
              <label>
                <span>Brand</span>
                <input type="color" value={activeBusiness.primary} onChange={(event) => updateBusinessBrand(activeBusiness.id, { primary: event.target.value })} />
              </label>
              <label>
                <span>Accent</span>
                <input type="color" value={activeBusiness.accent} onChange={(event) => updateBusinessBrand(activeBusiness.id, { accent: event.target.value })} />
              </label>
            </div>
            <div className="super-mini-preview">
              <div>
                <strong>{activeBusiness.name}</strong>
                <span>Branded portal preview</span>
              </div>
              <button>Primary action</button>
            </div>
            <div className="preview-actions">
              <a href="/business-admin">Preview admin</a>
              <a href="/staff">Preview staff</a>
            </div>
          </section>

          <section className="panel selected-invite-card">
            <PanelHeader icon={Mail} title="Setup invite" action={`${activeBusinessInvites.length || 0} links`} />
            {activeBusinessInvites.length ? activeBusinessInvites.slice(0, 2).map((invite) => (
              <div className="invite-row compact" key={invite.id}>
                <div>
                  <strong>{invite.contactName}</strong>
                  <span>{invite.adminEmail}</span>
                  <span>Expires {formatRelativeDate(invite.expiresAt)}</span>
                </div>
                <div className="invite-actions">
                  <span className={inviteStatus(invite) === 'accepted' ? 'status-dot active' : inviteStatus(invite) === 'expired' ? 'status-dot paused' : 'status-dot pending'}>{inviteStatus(invite)}</span>
                  <button onClick={() => sendInviteEmail(invite.id)} disabled={inviteSendingId === invite.id || inviteStatus(invite) !== 'pending'}>
                    {inviteSendingId === invite.id ? 'Sending' : 'Email'}
                  </button>
                  <a className="secondary-action compact-action" href={buildInviteUrl(invite)} target="_blank" rel="noreferrer">Preview</a>
                  <button onClick={() => copyInviteLink(invite.id)}>{copiedInviteId === invite.id ? 'Copied' : 'Copy'}</button>
                </div>
              </div>
            )) : (
              <div className="simple-empty-orders compact">
                <Mail size={20} />
                <strong>No setup invite yet</strong>
                <span>Add an admin email when creating this business.</span>
              </div>
            )}
          </section>
        </aside>
      </section>

      <section className="super-advanced-grid">
        <details className="panel admin-drawer">
          <summary><ShieldCheck size={18} /> Platform SMS <span>{masterSmsSettings.status === 'connected' ? providerName(masterSmsSettings.provider) : 'Not configured'}</span></summary>
          <MasterSmsSettingsPanel
            settings={masterSmsSettings}
            draft={masterSmsDraft}
            updateDraft={updateMasterSmsDraft}
            saveProvider={saveMasterSmsProvider}
            testProvider={testMasterSmsProvider}
            disconnectProvider={disconnectMasterSmsProvider}
            notice={smsNotice}
          />
        </details>

        <details className="panel admin-drawer">
          <summary><MessageSquareText size={18} /> Usage logs <span>{smsLogs.length} events</span></summary>
          <SmsUsageLog logs={smsLogs} />
        </details>

        <details className="panel admin-drawer">
          <summary><Activity size={18} /> Platform health <span>Ready</span></summary>
          <div className="activity-list">
            <div><strong>Tenant isolation</strong><span>Business data stays scoped by organisation.</span></div>
            <div><strong>Branding</strong><span>Logo and colours load from selected organisation context.</span></div>
          </div>
        </details>
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
                  setEmail(defaultEmailByRole[key]);
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
          <strong>Use your Verola account</strong>
          <span>Business admins and staff sign in after accepting their invite.</span>
          <span>Each login only opens the dashboard assigned to that account.</span>
        </div>
        <a className="login-link" href="/overview">View product overview</a>
      </section>
    </main>
  );
}

function ProductOverviewView() {
  const overviewWorkflow = [
    ['01', 'Received', 'New customer job added'],
    ['02', 'In progress', 'Team starts the work'],
    ['03', 'Ready', 'Customer gets notified'],
    ['04', 'Completed', 'Job archived for history']
  ];
  const industries = [
    ['Laundromats', 'Drop-off orders, ready alerts, payment records'],
    ['Repair shops', 'Job progress, customer notes, pickup updates'],
    ['Detailers', 'Daily work queue, staff handover, status messages'],
    ['Clinics & salons', 'Appointments, reminders, simple customer updates']
  ];

  return (
    <main className="overview-screen">
      <section className="overview-hero">
        <div className="overview-hero-copy">
          <div className="brand-lockup overview-brand">
            <BrandMark className="login-logo" />
            <div>
              <strong>Verola</strong>
              <span>Run your business. Grow every day.</span>
            </div>
          </div>
          <div>
            <span className="eyebrow">Client updates and job tracking for service businesses</span>
            <h1>A cleaner way to run customer jobs, staff shifts, and pickup updates.</h1>
            <p>Verola gives each business a polished branded workspace for active orders, customer SMS updates, payments, notes, staff rosters, and daily job history.</p>
          </div>
          <div className="overview-actions">
            <a className="primary-action" href="/login">Sign in</a>
            <a className="secondary-action" href="#workflow">See how it works</a>
          </div>
          <div className="overview-trust-row" aria-label="Product highlights">
            <span>White-label ready</span>
            <span>Mobile friendly</span>
            <span>Built for daily operations</span>
          </div>
        </div>
        <aside className="overview-product-card" aria-label="Verola workflow preview">
          <div className="overview-product-header">
            <div>
              <span>Today</span>
              <strong>Active jobs</strong>
            </div>
            <span className="overview-live-pill">Live</span>
          </div>
          <div className="overview-job-preview">
            <div>
              <strong>Sarah McKenzie</strong>
              <span>2 bags wash and fold</span>
            </div>
            <span className="status-badge green">Ready</span>
          </div>
          <div className="overview-message-preview">
            <MessageSquareText size={18} />
            <span>Customer notified at 2:41 PM</span>
          </div>
          <div className="overview-mini-stats">
            <div><strong>12</strong><span>Jobs today</span></div>
            <div><strong>4</strong><span>Ready</span></div>
            <div><strong>3</strong><span>On shift</span></div>
          </div>
        </aside>
      </section>
      <section className="overview-grid" id="workflow">
        {productHighlights.map((highlight, index) => (
          <article className="overview-card" key={highlight}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <CheckCircle2 size={20} />
            <p>{highlight}</p>
          </article>
        ))}
      </section>
      <section className="overview-industry-strip">
        {overviewWorkflow.map(([step, title, copy]) => (
          <div key={step}>
            <small>{step}</small>
            <strong>{title}</strong>
            <span>{copy}</span>
          </div>
        ))}
      </section>
      <section className="overview-industries">
        <div>
          <span className="eyebrow">Built for real counters, workshops, and front desks</span>
          <h2>One workflow, personalised to each business.</h2>
        </div>
        <div className="overview-industries-grid">
          {industries.map(([title, copy]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function InviteAcceptView({
  invite,
  lookupPending,
  setupDraft,
  setSetupDraft,
  completeInviteSetup
}: {
  invite?: OrganisationInvite;
  lookupPending: boolean;
  setupDraft: SetupDraft;
  setSetupDraft: (draft: SetupDraft | ((current: SetupDraft) => SetupDraft)) => void;
  completeInviteSetup: (token: string) => void;
}) {
  const brand = useBranding();
  const status = invite ? inviteStatus(invite) : undefined;
  const hasMagicParams = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('userId');
  const isStaffInvite = invite?.role === 'staff';
  const roleLabel = isStaffInvite ? 'Staff' : 'Business Admin';

  const errorTitle = !invite
    ? 'Invite not found'
    : status === 'accepted'
      ? 'Already accepted'
      : status === 'expired'
        ? 'Invite expired'
        : 'Link unavailable';

  const errorCopy = !invite
    ? 'This invite link is invalid or could not be found. Check the link or ask the platform owner to resend.'
    : status === 'accepted'
      ? `This setup link has already been used. Sign in with your ${isStaffInvite ? 'staff' : 'business admin'} account.`
      : 'This setup link has expired. Ask the platform owner to send a new invite.';

  // The token or ID used to complete setup
  const inviteKey = invite?.token || invite?.id || '';

  return (
    <main className="login-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <BrandMark className="login-logo" />
          <div>
            <strong>{brand.name}</strong>
            <span>{roleLabel} setup · Powered by {brand.poweredBy}</span>
          </div>
        </div>

        {lookupPending && !invite ? (
          <>
            <div>
              <span className="eyebrow">Checking invite</span>
              <h1>Loading setup link</h1>
              <p className="login-copy">We’re verifying this Verola invite and preparing your setup page.</p>
            </div>
          </>
        ) : invite && status === 'pending' ? (
          <>
            <div>
              <span className="eyebrow">You've been invited</span>
              <h1>{invite.businessName}</h1>
              <p className="login-copy">
                {invite.contactName && invite.contactName !== 'Business owner'
                  ? `Hi ${invite.contactName} — your `
                  : 'Your '}
                {invite.businessName} workspace on Verola is ready. Create your {isStaffInvite ? 'staff' : 'admin'} account to get started.
              </p>
            </div>
            <div className="login-help">
              <strong>Invite details</strong>
              <span>Organisation: {invite.businessName}</span>
              <span>Email: {invite.adminEmail}</span>
              <span>Role: {roleLabel}</span>
              <span>Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span>
              {hasMagicParams && <span>Verified via email link ✓</span>}
            </div>
            <div className="login-form">
              <input value={invite.adminEmail} readOnly aria-label="Email address" />
              <input
                value={setupDraft.name}
                onChange={(event) => setSetupDraft((current) => ({ ...current, name: event.target.value, error: '' }))}
                placeholder="Your full name"
                autoComplete="name"
              />
              <input
                value={setupDraft.password}
                onChange={(event) => setSetupDraft((current) => ({ ...current, password: event.target.value, error: '' }))}
                placeholder="Create a password (min 8 characters)"
                type="password"
                autoComplete="new-password"
              />
            </div>
            {setupDraft.error && <p className="login-error">{setupDraft.error}</p>}
            <button className="primary-action" onClick={() => completeInviteSetup(inviteKey)}>
              <CheckCircle2 size={18} />
              Complete setup &amp; open dashboard
            </button>
            <a className="login-link" href="/login">Already have an account? Sign in</a>
          </>
        ) : (
          <>
            <div>
              <span className="eyebrow">{!invite ? 'Invite not found' : status === 'accepted' ? 'Already accepted' : 'Invite expired'}</span>
              <h1>{errorTitle}</h1>
              <p className="login-copy">{errorCopy}</p>
            </div>
            <a className="primary-action" href="/login">Go to login</a>
            <a className="login-link" href="/">Back to Verola</a>
          </>
        )}
      </section>
    </main>
  );
}

function CustomerStatusView({ job, business, workflowStages }: { job?: Job; business?: Business; workflowStages: Record<JobStatus, WorkflowStage> }) {
  const fallbackBrand = useBranding();
  const brand = business ? brandFromBusiness(business) : fallbackBrand;
  const currentIndex = job ? statusFlow.indexOf(job.status) : -1;

  return (
    <main className="login-screen customer-status-screen" style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <section className="login-panel customer-status-card branded-status-card">
        <div className="brand-lockup login-brand">
          {business ? <BusinessLogo business={business} className="login-logo" /> : <BrandMark className="login-logo" />}
          <div>
            <strong>{brand.name}</strong>
            <span>{business ? `${business.industry} updates` : 'Customer update'} · Powered by Verola</span>
          </div>
        </div>
        {job && business ? (
          <>
            <div className="customer-status-hero">
              <span className="eyebrow">Live order status</span>
              <h1>{workflowStages[job.status].label}</h1>
              <p>{job.item}</p>
            </div>
            <div className="customer-progress-line" aria-label="Order progress">
              {statusFlow.map((status, index) => (
                <div className={index <= currentIndex ? 'customer-progress-step done' : 'customer-progress-step'} key={status}>
                  <span>{index + 1}</span>
                  <strong>{workflowStages[status].label}</strong>
                </div>
              ))}
            </div>
            <div className="customer-status-summary">
              <div>
                <span>Customer</span>
                <strong>{job.customer}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{job.paid ? 'Paid' : 'Not paid yet'}</strong>
              </div>
              <div>
                <span>Last update</span>
                <strong>{job.updates[0]?.at || 'Just now'}</strong>
              </div>
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
  rosterToast: WorkflowToast | null;
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
  applyIndustryPreset: (presetKey?: string) => void;
  smsNotice: string;
  workflowToast: WorkflowToast | null;
  masterSmsSettings: MasterSmsSettings;
  sendTestSms: () => void;
  smsLogs: SmsLog[];
  smsTemplates: Record<JobStatus, string>;
  setSmsTemplate: (status: JobStatus, body: string) => void;
  newCustomer: string;
  setNewCustomer: (value: string) => void;
  newPhone: string;
  setNewPhone: (value: string) => void;
  newJobNotes: string;
  setNewJobNotes: (value: string) => void;
  newJobPaid: boolean;
  setNewJobPaid: (value: boolean) => void;
  addJob: () => void;
  staffInviteName: string;
  setStaffInviteName: (value: string) => void;
  staffInviteEmail: string;
  setStaffInviteEmail: (value: string) => void;
  staffInvitePhone: string;
  setStaffInvitePhone: (value: string) => void;
  inviteStaffMember: () => void;
  staffInvites: OrganisationInvite[];
  removeStaffMember: (member: StaffMember) => void;
  copiedInviteId: string;
  inviteSendingId: string;
  inviteNotice: string;
  copyInviteLink: (inviteId: string) => void;
  sendInviteEmail: (inviteId: string) => void;
}) {
  const pendingRosterReplies = props.rosterShifts.filter((shift) => shift.response === 'sent').length;
  const [jobsView, setJobsView] = useState<BusinessJobsView>('active');
  const activeJobs = props.jobs.filter((job) => job.status !== 'completed');
  const completedJobs = props.jobs.filter((job) => job.status === 'completed');
  const readyJobs = activeJobs.filter((job) => job.status === 'ready_for_pickup').length;
  const inProgressJobs = activeJobs.filter((job) => job.status === 'in_progress').length;
  const unpaidActiveJobs = activeJobs.filter((job) => !job.paid).length;
  const onShiftCount = props.staff.filter((member) => member.clockedIn).length;
  const industryPreset = industryPresetFor(props.business.industry);
  const smsReady = props.masterSmsSettings.status === 'connected' && Boolean(appwriteSmsFunctionId);
  const activeBusinessLocation = [props.business.industry, props.business.location].filter(Boolean).join(' · ');
  const focusMessage = activeJobs.length
    ? `${inProgressJobs} in progress, ${readyJobs} ready, ${unpaidActiveJobs} unpaid.`
    : 'No active work waiting. Add the next customer order when they arrive.';
  const focusCards = [
    {
      label: 'Active queue',
      value: activeJobs.length,
      detail: activeJobs.length ? `${inProgressJobs} being worked on` : 'Clear for now',
      tone: 'brand'
    },
    {
      label: 'Ready to hand over',
      value: readyJobs,
      detail: readyJobs ? 'Customers can collect' : 'Nothing waiting',
      tone: readyJobs ? 'success' : 'neutral'
    },
    {
      label: 'Payments',
      value: unpaidActiveJobs,
      detail: unpaidActiveJobs ? 'Need follow-up' : 'Active jobs paid',
      tone: unpaidActiveJobs ? 'warning' : 'success'
    },
    {
      label: 'Team today',
      value: onShiftCount,
      detail: pendingRosterReplies ? `${pendingRosterReplies} roster replies` : 'Roster quiet',
      tone: pendingRosterReplies ? 'warning' : 'neutral'
    }
  ];
  const visibleHistoryJobs = props.jobs;
  const visibleJobsForView = jobsView === 'active' ? activeJobs : jobsView === 'completed' ? completedJobs : visibleHistoryJobs;
  const operationalSelectedJob = visibleJobsForView.find((job) => job.id === props.selectedJob?.id);
  const latestRosterActivity = rosterActivity(props.rosterShifts).find((item) => item.shift.response === 'accepted' || item.shift.response === 'declined');
  const clockNotice = props.smsNotice.toLowerCase().includes('clocked') ? props.smsNotice : '';
  const liveStaffNotice = props.rosterToast?.message || clockNotice || (latestRosterActivity ? `${latestRosterActivity.shift.staffName} ${latestRosterActivity.shift.response} ${latestRosterActivity.shift.start} roster` : '');
  const liveStaffNoticeTone: WorkflowToast['tone'] = props.rosterToast?.tone ?? (latestRosterActivity?.tone === 'declined' ? 'warning' : 'success');

  return (
    <div className="business-admin-layout">
      <section className="business-command branded-daily-command">
        <div className="daily-command-main">
          <BusinessLogo business={props.business} className="daily-command-logo" />
          <div>
            <span className="eyebrow">{greetingForNow()}</span>
            <h2>Today at {props.business.name}</h2>
            <p>{activeJobs.length ? `${activeJobs.length} active jobs in the queue. ${readyJobs} ready for pickup.` : 'A clean workspace for today’s jobs.'}</p>
            <div className="business-identity-row" aria-label="Business profile">
              {activeBusinessLocation && <span>{activeBusinessLocation}</span>}
              <span>{industryPreset.label}</span>
              <span>{smsReady ? 'SMS ready' : 'SMS needs setup'}</span>
            </div>
            <small className="powered-by-inline">Powered by Verola</small>
          </div>
        </div>
        <div className="command-stats stats-4">
          <div><strong>{activeJobs.length}</strong><span>Active jobs</span></div>
          <div><strong>{readyJobs}</strong><span>Ready</span></div>
          <div><strong>{onShiftCount}</strong><span>On shift</span></div>
          <div><strong>{props.masterSmsSettings.status === 'connected' && appwriteSmsFunctionId ? 'On' : 'Off'}</strong><span>SMS</span></div>
        </div>
      </section>

      <section className="business-focus-strip" aria-label="Today’s business focus">
        <div className="focus-copy">
          <span className="eyebrow">Today’s focus</span>
          <h3>{activeJobs.length ? 'Keep work moving and customers updated.' : 'Start the day with a clean queue.'}</h3>
          <p>{focusMessage}</p>
        </div>
        <div className="focus-card-grid">
          {focusCards.map((card) => (
            <div className={`focus-card ${card.tone}`} key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <nav className="business-quick-actions" aria-label="Business shortcuts">
        <a href="#add-order"><Plus size={17} /> Add order</a>
        <a href="#active-orders"><ClipboardList size={17} /> Active jobs</a>
        <a href="#staff-rosters"><CalendarPlus size={17} /> Rosters</a>
        <a href="#workflow-settings"><Settings size={17} /> Workflow</a>
      </nav>

      {liveStaffNotice && (
        <div className={`workflow-toast roster admin-live-toast ${liveStaffNoticeTone}`}>
          {liveStaffNoticeTone === 'success' ? <CheckCircle2 size={17} /> : <Bell size={17} />}
          <span>{liveStaffNotice}</span>
        </div>
      )}

      <section className="panel create-job admin-primary-panel" id="add-order">
        <PanelHeader icon={Plus} title="Add order" action="Name, mobile, details" />
        <div className="quick-form">
          <input value={props.newCustomer} onChange={(event) => props.setNewCustomer(event.target.value)} placeholder="Customer name" />
          <input value={props.newPhone} onChange={(event) => props.setNewPhone(event.target.value)} placeholder="Mobile number" />
          <textarea value={props.newJobNotes} onChange={(event) => props.setNewJobNotes(event.target.value)} placeholder="Order details or notes..." rows={2} />
          <label className="paid-toggle">
            <input type="checkbox" checked={props.newJobPaid} onChange={(event) => props.setNewJobPaid(event.target.checked)} />
            Already paid
          </label>
          <button className="primary-action" onClick={props.addJob} disabled={!props.newCustomer.trim() || !props.newPhone.trim()}>
            <Plus size={18} />
            Add order
          </button>
        </div>
      </section>

      <section className="panel workflow-panel" id="active-orders">
        <JobsHeader query={props.query} setQuery={props.setQuery} />
        {props.workflowToast && (
          <div className={`workflow-toast ${props.workflowToast.tone}`} key={props.workflowToast.id}>
            {props.workflowToast.tone === 'success' ? <CheckCircle2 size={17} /> : <Bell size={17} />}
            <span>{props.workflowToast.message}</span>
          </div>
        )}
        <BusinessJobsNav activeView={jobsView} setView={setJobsView} activeCount={activeJobs.length} completedCount={completedJobs.length} historyCount={props.jobs.length} />
        {jobsView === 'active' && <QueueStageSummary jobs={activeJobs} workflowStages={props.workflowStages} />}
        <div className={operationalSelectedJob ? 'simple-order-shell has-drawer' : 'simple-order-shell'}>
          {jobsView === 'active' && (
            <SimpleOrderList
              jobs={activeJobs}
              selectedJobId={operationalSelectedJob?.id}
              setSelectedJobId={props.setSelectedJobId}
              workflowStages={props.workflowStages}
              updateJobStatus={props.updateJobStatus}
              toggleJobPaid={props.toggleJobPaid}
            />
          )}
          {jobsView === 'completed' && (
            <CompletedJobsList jobs={completedJobs} selectedJobId={operationalSelectedJob?.id} setSelectedJobId={props.setSelectedJobId} />
          )}
          {jobsView === 'history' && (
            <HistoryJobsList jobs={visibleHistoryJobs} selectedJobId={operationalSelectedJob?.id} setSelectedJobId={props.setSelectedJobId} workflowStages={props.workflowStages} />
          )}
          {operationalSelectedJob && <JobDetail job={operationalSelectedJob} updateJobStatus={props.updateJobStatus} addJobNote={props.addJobNote} toggleJobPaid={props.toggleJobPaid} workflowStages={props.workflowStages} />}
        </div>
      </section>

      <section className="admin-secondary-grid">
        <details className="panel admin-drawer roster-drawer" id="staff-rosters">
          <summary><CalendarPlus size={18} /> Rostering <span>{pendingRosterReplies} pending</span></summary>
          <RosterOperationsSummary shifts={props.rosterShifts} toast={props.rosterToast} />
          <RosterPlanner
            staff={props.staff}
            shifts={props.rosterShifts}
            draft={props.rosterDraft}
            setDraft={props.setRosterDraft}
            addShift={props.addRosterShift}
            deleteShift={props.deleteRosterShift}
          />
        </details>
      </section>

      <section className="admin-support-grid">
        <details className="panel admin-drawer" id="workflow-settings">
          <summary><Settings size={18} /> Workflow stages <span>4 automated stages</span></summary>
          <p className="workflow-editor-note">These stages control the internal order flow. Customer text is controlled separately in Messaging templates.</p>
          <div className="preset-banner">
            <div>
              <strong>{industryPreset.label}</strong>
              <span>Apply a clean workflow and SMS wording for {props.business.industry || 'this business'}.</span>
            </div>
            <button type="button" onClick={() => props.applyIndustryPreset()}>Apply preset</button>
          </div>
          <IndustryPresetPicker activeKey={industryPresetKey(props.business.industry)} applyPreset={props.applyIndustryPreset} />
          <WorkflowStageEditor stages={props.workflowStages} setStage={props.setWorkflowStage} />
        </details>

        <details className="panel admin-drawer">
          <summary><MessageSquareText size={18} /> Messaging <span>{props.masterSmsSettings.status === 'connected' && appwriteSmsFunctionId ? 'SMS active' : 'SMS unavailable'}</span></summary>
          <BusinessSmsStatus settings={props.masterSmsSettings} notice={props.smsNotice} sendTestSms={props.sendTestSms} logs={props.smsLogs} />
          <SmsTemplateEditor templates={props.smsTemplates} setTemplate={props.setSmsTemplate} workflowStages={props.workflowStages} />
        </details>

        <details className="panel admin-drawer">
          <summary><Users size={18} /> Staff and shifts <span>{props.staff.length} users</span></summary>
          <StaffInvitePanel
            name={props.staffInviteName}
            setName={props.setStaffInviteName}
            email={props.staffInviteEmail}
            setEmail={props.setStaffInviteEmail}
            phone={props.staffInvitePhone}
            setPhone={props.setStaffInvitePhone}
            inviteStaffMember={props.inviteStaffMember}
            invites={props.staffInvites}
            copiedInviteId={props.copiedInviteId}
            inviteSendingId={props.inviteSendingId}
            inviteNotice={props.inviteNotice}
            copyInviteLink={props.copyInviteLink}
            sendInviteEmail={props.sendInviteEmail}
          />
          <StaffShiftOverview staff={props.staff} removeStaffMember={props.removeStaffMember} />
        </details>
      </section>
    </div>
  );
}

function StaffInvitePanel({
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  inviteStaffMember,
  invites,
  copiedInviteId,
  inviteSendingId,
  inviteNotice,
  copyInviteLink,
  sendInviteEmail
}: {
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  inviteStaffMember: () => void;
  invites: OrganisationInvite[];
  copiedInviteId: string;
  inviteSendingId: string;
  inviteNotice: string;
  copyInviteLink: (inviteId: string) => void;
  sendInviteEmail: (inviteId: string) => void;
}) {
  const pendingInvites = invites.filter((invite) => inviteStatus(invite) === 'pending');

  return (
    <div className="staff-invite-panel">
      <div className="detail-section-title">
        <strong>Invite staff</strong>
        <span>{pendingInvites.length} pending</span>
      </div>
      <div className="staff-invite-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Staff name" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile optional" />
        <button className="primary-action" onClick={inviteStaffMember} disabled={!name.trim() || !email.trim()}>
          <Mail size={17} />
          Send invite
        </button>
      </div>
      {inviteNotice && <div className="inline-notice compact">{inviteNotice}</div>}
      {pendingInvites.length > 0 && (
        <div className="staff-invite-list">
          {pendingInvites.slice(0, 4).map((invite) => (
            <div className="staff-invite-row" key={invite.id}>
              <div>
                <strong>{invite.contactName}</strong>
                <span>{invite.adminEmail} · {inviteStatus(invite)}</span>
              </div>
              <div>
                <button onClick={() => sendInviteEmail(invite.id)} disabled={inviteSendingId === invite.id || inviteStatus(invite) !== 'pending'}>
                  {inviteSendingId === invite.id ? 'Sending' : 'Send'}
                </button>
                <button onClick={() => copyInviteLink(invite.id)}>{copiedInviteId === invite.id ? 'Copied' : 'Copy link'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffView(props: {
  business: Business;
  jobs: Job[];
  selectedJob?: Job;
  setSelectedJobId: (id: string) => void;
  toggleJobPaid: (jobId: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  query: string;
  setQuery: (query: string) => void;
  staffMember: StaffMember;
  rosterShifts: RosterShift[];
  rosterToast: WorkflowToast | null;
  updateRosterResponse: (shiftId: string, response: ShiftResponse) => void;
  toggleClock: () => void;
}) {
  const activeJobs = props.jobs.filter((job) => job.status !== 'completed');
  const staffSelectedJob = props.selectedJob && props.selectedJob.status !== 'completed'
    ? props.selectedJob
    : activeJobs[0];

  return (
    <div className="staff-layout">
      <section className="shift-hero">
        <div className="staff-shift-intro">
          <BusinessLogo business={props.business} className="staff-shift-logo" />
          <div>
            <span className="eyebrow">Hi {props.staffMember.name.split(' ')[0] || 'there'}</span>
            <h2>{props.staffMember.clockedIn ? `You're working with ${props.business.name}` : `Ready for ${props.business.name}?`}</h2>
            <p>{props.staffMember.clockedIn ? `Started ${props.staffMember.clockInAt} · ${props.staffMember.hoursToday.toFixed(1)}h today` : `Last shift ${props.staffMember.lastShift}`}</p>
            <small className="powered-by-inline">Powered by Verola</small>
          </div>
        </div>
        <button className={props.staffMember.clockedIn ? 'clock-action clock-out' : 'clock-action'} onClick={props.toggleClock}>
          {props.staffMember.clockedIn ? <LogOut size={20} /> : <LogIn size={20} />}
          {props.staffMember.clockedIn ? 'Clock out' : 'Clock in'}
        </button>
      </section>
      <section className="panel wide">
        <JobsHeader query={props.query} setQuery={props.setQuery} />
        <div className="staff-jobs-shell">
          <StaffJobList
            jobs={activeJobs}
            selectedJobId={staffSelectedJob?.id}
            setSelectedJobId={props.setSelectedJobId}
            workflowStages={props.workflowStages}
          />
          <StaffJobReadOnlyDetail
            job={staffSelectedJob}
            workflowStages={props.workflowStages}
          />
        </div>
      </section>
      <section className="panel wide">
        <PanelHeader icon={CalendarPlus} title="My shifts" action={`${props.rosterShifts.filter((shift) => shift.response === 'sent').length} to reply`} />
        {props.rosterToast && (
          <div className={`workflow-toast roster ${props.rosterToast.tone}`} key={props.rosterToast.id}>
            {props.rosterToast.tone === 'success' ? <CheckCircle2 size={17} /> : <Bell size={17} />}
            <span>{props.rosterToast.message}</span>
          </div>
        )}
        <StaffRoster shifts={props.rosterShifts} updateRosterResponse={props.updateRosterResponse} />
      </section>
    </div>
  );
}

function StaffJobList({
  jobs,
  selectedJobId,
  setSelectedJobId,
  workflowStages
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
}) {
  if (!jobs.length) {
    return (
      <div className="staff-job-list empty">
        <ClipboardList size={22} />
        <strong>No active jobs</strong>
        <span>Active work will appear here when new jobs are added.</span>
      </div>
    );
  }

  return (
    <div className="staff-job-list">
      {jobs.map((job) => (
        <button
          className={job.id === selectedJobId ? 'staff-job-row selected' : 'staff-job-row'}
          key={job.id}
          onClick={() => setSelectedJobId(job.id)}
        >
          <div>
            <strong>{job.customer}</strong>
            <span>{job.item}</span>
          </div>
          <div className="staff-job-meta">
            <StatusBadge status={job.status} workflowStages={workflowStages} />
            <PaymentBadge paid={job.paid} />
          </div>
        </button>
      ))}
    </div>
  );
}

function StaffJobReadOnlyDetail({
  job,
  workflowStages
}: {
  job?: Job;
  workflowStages: Record<JobStatus, WorkflowStage>;
}) {
  if (!job) {
    return (
      <aside className="staff-job-detail empty">
        <Sparkles size={22} />
        <strong>Select a job</strong>
        <span>Job details and internal notes will show here.</span>
      </aside>
    );
  }

  return (
    <aside className="staff-job-detail">
      <div className="detail-section-title">
        <strong>Job details</strong>
        <span>{job.id}</span>
      </div>
      <div className="staff-detail-card">
        <h2>{job.customer}</h2>
        <span>{job.phone}</span>
        <p>{job.item}</p>
        <div className="staff-detail-badges">
          <StatusBadge status={job.status} workflowStages={workflowStages} />
          <PaymentBadge paid={job.paid} />
        </div>
      </div>
      <div className="staff-stage-strip">
        {statusFlow.filter((status) => status !== 'completed').map((status, index) => (
          <div key={status} className={statusFlow.indexOf(job.status) >= index ? 'staff-stage done' : 'staff-stage'}>
            <span>{index + 1}</span>
            <strong>{workflowStages[status].label}</strong>
          </div>
        ))}
      </div>
      <div className="job-note staff-notes">
        <div className="detail-section-title">
          <strong>Internal notes</strong>
          <span>Staff only</span>
        </div>
        {job.notes.split('\n').map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </div>
    </aside>
  );
}

function JobsHeader({ query, setQuery }: { query: string; setQuery: (query: string) => void }) {
  return (
    <div className="jobs-header">
      <PanelHeader icon={History} title="Orders" action="Simple list" />
      <label className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, order" />
      </label>
    </div>
  );
}

function BusinessJobsNav({
  activeView,
  setView,
  activeCount,
  completedCount,
  historyCount
}: {
  activeView: BusinessJobsView;
  setView: (view: BusinessJobsView) => void;
  activeCount: number;
  completedCount: number;
  historyCount: number;
}) {
  return (
    <div className="business-jobs-nav" aria-label="Jobs view">
      <button className={`queue-focus-card ${activeView === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
        <span>Active queue</span>
        <strong>{activeCount}</strong>
      </button>
      <div className="queue-archive-links">
        <button className={activeView === 'completed' ? 'active' : ''} onClick={() => setView('completed')}>
          <span>Completed today</span>
          <strong>{completedCount}</strong>
        </button>
        <button className={activeView === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          <span>Past jobs</span>
          <strong>{historyCount}</strong>
        </button>
      </div>
    </div>
  );
}

function QueueStageSummary({ jobs, workflowStages }: { jobs: Job[]; workflowStages: Record<JobStatus, WorkflowStage> }) {
  const stages = statusFlow.filter((status) => status !== 'completed');
  return (
    <div className="queue-stage-summary" aria-label="Active order stages">
      {stages.map((status, index) => {
        const count = jobs.filter((job) => job.status === status).length;
        return (
          <div className="queue-stage-pill" key={status}>
            <span>{index + 1}</span>
            <div>
              <strong>{simpleStageLabel(status, workflowStages)}</strong>
              <small>{count} active</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimpleOrderTabs({
  jobs,
  activeFilter,
  setFilter,
  workflowStages
}: {
  jobs: Job[];
  activeFilter: SimpleOrderFilter;
  setFilter: (filter: SimpleOrderFilter) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
}) {
  const tabs: Array<{ key: SimpleOrderFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: jobs.length },
    { key: 'collected', label: simpleStageLabel('collected', workflowStages), count: jobs.filter((job) => job.status === 'collected').length },
    { key: 'in_progress', label: simpleStageLabel('in_progress', workflowStages), count: jobs.filter((job) => job.status === 'in_progress').length },
    { key: 'ready_for_pickup', label: simpleStageLabel('ready_for_pickup', workflowStages), count: jobs.filter((job) => job.status === 'ready_for_pickup').length }
  ];

  return (
    <div className="simple-order-tabs">
      {tabs.map((tab) => (
        <button key={tab.key} className={activeFilter === tab.key ? 'active' : ''} onClick={() => setFilter(tab.key)}>
          <span>{tab.label}</span>
          <strong>{tab.count}</strong>
        </button>
      ))}
    </div>
  );
}

function SimpleOrderList({
  jobs,
  selectedJobId,
  setSelectedJobId,
  workflowStages,
  updateJobStatus,
  toggleJobPaid
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  toggleJobPaid: (jobId: string) => void;
}) {
  if (!jobs.length) {
    return (
      <div className="simple-empty-orders">
        <ClipboardList size={22} />
        <strong>No orders here</strong>
        <p>New orders will appear in this list.</p>
      </div>
    );
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    const statusDifference = statusFlow.indexOf(a.status) - statusFlow.indexOf(b.status);
    return statusDifference || a.customer.localeCompare(b.customer);
  });

  return (
    <div className="simple-order-list queue">
      <div className="simple-order-head" aria-hidden="true">
        <span>Customer</span>
        <span>Order</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      {sortedJobs.map((job) => {
        const notification = latestNotification(job);
        const nextStatus = nextJobStatus(job.status);
        return (
          <article className={`simple-order-card ${selectedJobId === job.id ? 'selected' : ''}`} key={job.id} onClick={() => setSelectedJobId(job.id)}>
            <div className="simple-order-main">
              <div>
                <strong>{job.customer}</strong>
                <span>{job.phone}</span>
              </div>
            </div>
            <p>{job.item}</p>
            <div className="simple-order-meta">
              <StatusBadge status={job.status} workflowStages={workflowStages} />
              <PaymentBadge paid={job.paid} />
              <SmsStatePill notification={notification} />
              <span>Updated {lastUpdateLabel(job)}</span>
            </div>
            <div className="simple-order-actions" onClick={(event) => event.stopPropagation()}>
              {nextStatus && <button className="primary-simple-action" onClick={() => updateJobStatus(job.id, nextStatus)}>{queueActionLabel(nextStatus, workflowStages)}</button>}
              <button className="secondary-simple-action" onClick={() => toggleJobPaid(job.id)}>{job.paid ? 'Mark unpaid' : 'Mark paid'}</button>
              <button className="ghost-simple-action" type="button" onClick={() => setSelectedJobId(job.id)}>Details</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CompletedJobsList({
  jobs,
  selectedJobId,
  setSelectedJobId
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
}) {
  if (!jobs.length) {
    return (
      <div className="simple-empty-orders">
        <CheckCircle2 size={22} />
        <strong>No completed jobs today</strong>
        <p>Complete an active order and it will move here automatically.</p>
      </div>
    );
  }

  return (
    <div className="completed-jobs-list">
      {jobs.map((job) => {
        const notification = latestNotification(job);
        return (
          <button className={selectedJobId === job.id ? 'completed-job-row selected' : 'completed-job-row'} key={job.id} onClick={() => setSelectedJobId(job.id)}>
            <div>
              <strong>{job.customer}</strong>
              <span>{job.item}</span>
            </div>
            <span>{completionTime(job)}</span>
            <PaymentBadge paid={job.paid} />
            <SmsStatePill notification={notification} />
          </button>
        );
      })}
    </div>
  );
}

function HistoryJobsList({
  jobs,
  selectedJobId,
  setSelectedJobId,
  workflowStages
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
}) {
  if (!jobs.length) {
    return (
      <div className="simple-empty-orders">
        <Search size={22} />
        <strong>No past jobs found</strong>
        <p>Use search above to find previous customers and orders.</p>
      </div>
    );
  }

  return (
    <div className="history-jobs-list">
      {jobs.map((job) => (
        <button className={selectedJobId === job.id ? 'history-job-row selected' : 'history-job-row'} key={job.id} onClick={() => setSelectedJobId(job.id)}>
          <div>
            <strong>{job.customer}</strong>
            <span>{job.phone} · {job.item}</span>
          </div>
          <StatusBadge status={job.status} workflowStages={workflowStages} />
          <PaymentBadge paid={job.paid} />
          <span>{lastUpdateLabel(job)}</span>
        </button>
      ))}
    </div>
  );
}


function SmsStatePill({ notification }: { notification: JobNotification }) {
  const label = notification.state === 'delivered'
    ? `Delivered${notification.time ? ` · ${notification.time}` : ''}`
    : notification.state === 'ready'
      ? 'Sending…'
      : notification.state === 'failed'
        ? `Failed${notification.time ? ` · ${notification.time}` : ''}`
        : 'Unavailable';
  return <span className={`sms-state-pill ${notification.state}`}>{label}</span>;
}

function RosterOperationsSummary({ shifts, toast }: { shifts: RosterShift[]; toast: WorkflowToast | null }) {
  const accepted = shifts.filter((shift) => shift.response === 'accepted').length;
  const declined = shifts.filter((shift) => shift.response === 'declined').length;
  const pending = shifts.filter((shift) => shift.response === 'sent').length;
  const viewed = shifts.filter((shift) => shift.response === 'sent' && shift.viewedAt).length;
  const needsAction = shifts.filter(shiftNeedsRosterAttention);
  const recent = rosterActivity(shifts).slice(0, 4);

  return (
    <div className="roster-ops">
      {toast && (
        <div className={`workflow-toast roster ${toast.tone}`} key={toast.id}>
          {toast.tone === 'success' ? <CheckCircle2 size={17} /> : <Bell size={17} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="roster-kpis">
        <RosterKpi label="Accepted" value={accepted} tone="accepted" />
        <RosterKpi label="Viewed" value={viewed} tone="viewed" />
        <RosterKpi label="Pending" value={pending} tone="pending" />
        <RosterKpi label="Needs action" value={declined + needsAction.length} tone="declined" />
      </div>

      <div className="roster-live-grid">
        <div className="roster-feed">
          <div className="detail-section-title">
            <strong>Roster activity</strong>
            <span>Live responses</span>
          </div>
          {recent.length ? recent.map((item) => (
            <div className={`roster-feed-row ${item.tone}`} key={`${item.shift.id}-${item.label}`}>
              <span>{item.icon}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.shift.staffName} · {item.shift.start} - {item.shift.end} · {item.time}</small>
              </div>
            </div>
          )) : <p>No roster activity yet.</p>}
        </div>

        <div className="roster-attention">
          <div className="detail-section-title">
            <strong>Needs manager attention</strong>
            <span>{needsAction.length} shifts</span>
          </div>
          {needsAction.length ? needsAction.slice(0, 3).map((shift) => (
            <div className="attention-row" key={shift.id}>
              <div>
                <strong>{shift.staffName}</strong>
                <small>{formatRosterDate(shift.date)} · {shift.start} · {shift.area}</small>
              </div>
              <RosterStatusChip shift={shift} />
            </div>
          )) : <p>All visible shifts are covered or awaiting normal replies.</p>}
        </div>
      </div>
    </div>
  );
}

function RosterKpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`roster-kpi ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
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
        <div className="roster-calendar-scroll">
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
    </div>
  );
}

function RosterCalendarEvent({ shift, deleteShift }: { shift: RosterShift; deleteShift: (shiftId: string) => void }) {
  return (
    <div className={`roster-calendar-event ${rosterResponseTone(shift)}`}>
      <div>
        <strong>{shift.start} {shift.staffName}</strong>
        <span>{shift.area}</span>
        <RosterStatusChip shift={shift} />
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
            <RosterStatusChip shift={shift} />
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
        <RosterStatusChip shift={shift} />
        {(shift.respondedAt || shift.viewedAt || shift.sentAt) && <small>{shift.respondedAt ? `Responded ${shift.respondedAt}` : shift.viewedAt ? `Viewed ${shift.viewedAt}` : `Sent ${shift.sentAt}`}</small>}
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

function rosterResponseLabel(shift: RosterShift) {
  if (shift.response === 'accepted') return 'Accepted';
  if (shift.response === 'declined') return 'Declined';
  if (shift.viewedAt) return 'Viewed';
  if (shift.response === 'sent') return 'Pending';
  return 'Draft';
}

function rosterResponseTone(shift: RosterShift) {
  if (shift.response === 'accepted') return 'accepted';
  if (shift.response === 'declined') return 'declined';
  if (shift.viewedAt) return 'viewed';
  if (shift.response === 'sent') return 'pending';
  return 'draft';
}

function shiftNeedsRosterAttention(shift: RosterShift) {
  if (shift.response === 'declined') return true;
  if (shift.response !== 'sent') return false;
  const shiftDate = new Date(`${shift.date}T00:00:00`);
  if (Number.isNaN(shiftDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAway = Math.ceil((shiftDate.getTime() - today.getTime()) / 86400000);
  return daysAway <= 3;
}

function rosterActivity(shifts: RosterShift[]) {
  return [...shifts]
    .filter((shift) => shift.response !== 'draft')
    .map((shift) => {
      const tone = rosterResponseTone(shift);
      const label = shift.response === 'accepted'
        ? 'Shift accepted'
        : shift.response === 'declined'
          ? 'Shift declined'
          : shift.viewedAt
            ? 'Shift viewed'
            : shiftNeedsRosterAttention(shift)
              ? 'Pending too long'
              : 'Shift pending';
      const time = shift.respondedAt || shift.viewedAt || shift.sentAt || formatRosterDate(shift.date);
      const icon = shift.response === 'accepted' ? '✓' : shift.response === 'declined' ? '!' : shift.viewedAt ? 'Seen' : '•';
      return { shift, tone, label, time, icon };
    })
    .sort((a, b) => `${b.shift.respondedAt || b.shift.viewedAt || b.shift.sentAt || b.shift.date}`.localeCompare(`${a.shift.respondedAt || a.shift.viewedAt || a.shift.sentAt || a.shift.date}`));
}

function RosterStatusChip({ shift }: { shift: RosterShift }) {
  return <span className={`roster-status-chip ${rosterResponseTone(shift)}`}>{rosterResponseLabel(shift)}</span>;
}

function WorkflowBoard({
  jobs,
  selectedJobId,
  setSelectedJobId,
  workflowStages,
  staff = [],
  updateJobStatus,
  compact = false
}: {
  jobs: Job[];
  selectedJobId?: string;
  setSelectedJobId: (id: string) => void;
  workflowStages: Record<JobStatus, WorkflowStage>;
  staff?: StaffMember[];
  updateJobStatus?: (jobId: string, status: JobStatus) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'workflow-board operational-board compact' : 'workflow-board operational-board'}>
      {statusFlow.map((status, index) => {
        const columnJobs = jobs.filter((job) => job.status === status);
        return (
          <section className="workflow-column operational-lane" key={status}>
            <div className="workflow-column-header">
              <span>{index + 1}</span>
              <div>
                <strong>{workflowStages[status].label}</strong>
                <small>{columnJobs.length} jobs · {workflowStages[status].nextStep}</small>
              </div>
            </div>
            <div className="workflow-cards">
              {columnJobs.map((job) => {
                const notification = latestNotification(job);
                const nextStatus = nextJobStatus(job.status);
                const assigned = assignedStaffForJob(job, staff);
                const signal = operationalSignal(job, notification);
                return (
                  <article
                    key={job.id}
                    className={`job-card operational-card ${selectedJobId === job.id ? 'selected' : ''}`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="order-card-header">
                      <div className="order-identity">
                        <span>{job.id}</span>
                        <strong>{job.customer}</strong>
                        <small>{job.phone}</small>
                      </div>
                      <div className="order-card-badges">
                        <span className={job.priority === 'Urgent' ? 'priority urgent' : job.priority === 'Hold' ? 'priority hold' : 'priority'}>{job.priority}</span>
                        <PaymentBadge paid={job.paid} />
                      </div>
                    </div>
                    <div className="order-card-service">
                      <strong>{job.item}</strong>
                      <span>{job.serviceType} · {job.estimate}</span>
                    </div>
                    <div className="order-snapshot-grid">
                      <div><span>Updated</span><strong>{lastUpdateLabel(job)}</strong></div>
                      <div><span>Staff</span><strong>{assigned}</strong></div>
                    </div>
                    <div className={`job-notification ${notification.state}`}>
                      <span>{notification.state === 'delivered' ? '✓' : notification.state === 'ready' ? '⌛' : notification.state === 'failed' ? '!' : '•'}</span>
                      <div>
                        <strong>{notification.label}{notification.time ? ` · ${notification.time}` : ''}</strong>
                        <small>{notification.message}</small>
                      </div>
                    </div>
                    <div className="order-live-row">
                      <span className={`order-signal ${signal.tone}`}>{signal.label}</span>
                      {job.notes && <span className="notes-chip"><ClipboardList size={13} /> Notes</span>}
                    </div>
                    <div className="order-card-actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedJobId(job.id); }}>Open details</button>
                      {updateJobStatus && nextStatus && (
                        <button
                          type="button"
                          className="primary-mini"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateJobStatus(job.id, nextStatus);
                          }}
                        >
                          {workflowStages[nextStatus].verb}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {columnJobs.length === 0 && <p className="empty-column operational-empty">No orders in this stage</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MasterSmsSettingsPanel({
  settings,
  draft,
  updateDraft,
  saveProvider,
  testProvider,
  disconnectProvider,
  notice
}: {
  settings: MasterSmsSettings;
  draft: MasterSmsDraft;
  updateDraft: (patch: Partial<MasterSmsDraft>) => void;
  saveProvider: () => void;
  testProvider: () => void;
  disconnectProvider: () => void;
  notice: string;
}) {
  return (
    <div className="messaging-setup">
      <div className={settings.status === 'connected' ? 'messaging-status connected' : 'messaging-status'}>
        <div>
          <strong>{settings.status === 'connected' ? `${providerName(settings.provider)} master provider connected` : 'Master SMS provider not configured'}</strong>
          <p>{settings.status === 'connected' ? `Saved key ${settings.maskedKeyPreview}. All tenant SMS routes through this Super Admin managed provider.` : 'Business admins can still update job statuses, but customer SMS will be unavailable until Super Admin connects the platform provider.'}</p>
        </div>
        {settings.status === 'connected' && <CheckCircle2 size={22} />}
      </div>

      <div className="setup-steps">
        <Step number="1" title="Choose platform provider" text="Super Admin controls the single SMS provider for every tenant." />
        <Step number="2" title="Store secrets server-side" text="Production keys must live in environment variables or encrypted server-side storage, never frontend code." />
        <Step number="3" title="Send test SMS" text="Confirm the platform sender can queue messages before enabling customer updates." />
        <Step number="4" title="Audit per business" text="Every message log keeps the business, recipient, template, status, and provider response." />
      </div>

      <div className="provider-options">
        <button className={draft.provider === 'clicksend' ? 'selected' : ''} onClick={() => updateDraft({ provider: 'clicksend' })}>
          <strong>ClickSend</strong>
          <span>Easiest setup for Australian SMS delivery.</span>
        </button>
        <button className={draft.provider === 'telnyx' ? 'selected' : ''} onClick={() => updateDraft({ provider: 'telnyx' })}>
          <strong>Telnyx</strong>
          <span>Useful at scale, but more technical.</span>
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
        <button onClick={saveProvider}>Save Master Provider</button>
        <button className="danger" onClick={disconnectProvider}>Disconnect Provider</button>
      </div>

      {notice && <p className="messaging-notice">{notice}</p>}
      <p className="security-note">Raw SMS API keys are cleared immediately in the browser. Save live provider secrets only through a secure Appwrite Function or server route backed by encrypted secret storage.</p>
    </div>
  );
}

function StaffShiftOverview({ staff, removeStaffMember }: { staff: StaffMember[]; removeStaffMember: (member: StaffMember) => void }) {
  const groups = [
    { key: 'on', label: 'On shift', staff: staff.filter((member) => member.active && member.clockedIn) },
    { key: 'off', label: 'Off shift', staff: staff.filter((member) => member.active && !member.clockedIn) }
  ];

  return (
    <div className="staff-shift-overview">
      {groups.map((group) => (
        <div className="staff-shift-group" key={group.key}>
          <div className="section-mini-heading">
            <strong>{group.label}</strong>
            <span>{group.staff.length}</span>
          </div>
          <div className="staff-table">
            {group.staff.length ? group.staff.map((member) => (
              <div className="staff-table-row" key={`${member.businessId}-${member.email || member.phone || member.name}`}>
                <div className="staff-avatar">{member.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.role} · {member.phone}</span>
                </div>
                <div className="staff-hours">
                  <strong>{member.hoursToday.toFixed(1)}h</strong>
                  <span>{member.clockedIn ? `Since ${member.clockInAt}` : `Last ${member.lastShift}`}</span>
                </div>
                <span className={`staff-state-pill ${member.clockedIn ? 'active' : member.active ? 'off' : 'paused'}`}>
                  {member.clockedIn ? 'On shift' : 'Off shift'}
                </span>
                {member.role !== 'Owner' && (
                  <button className="staff-remove-button" onClick={() => removeStaffMember(member)}>
                    Remove access
                  </button>
                )}
              </div>
            )) : (
              <div className="staff-empty-row">No staff in this group.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BusinessSmsStatus({ settings, notice, sendTestSms, logs }: { settings: MasterSmsSettings; notice: string; sendTestSms: () => void; logs: SmsLog[] }) {
  const connected = settings.status === 'connected' && Boolean(appwriteSmsFunctionId);
  const lastSent = logs[0];
  return (
    <div className="business-messaging">
      <div className="sms-status-grid">
        <div className={connected ? 'sms-status-card active' : 'sms-status-card offline'}>
          <span className="sms-status-light" />
          <div>
            <small>SMS Status</small>
            <strong>{connected ? 'Messaging enabled' : 'Messaging unavailable'}</strong>
            <p>{connected ? 'Status changes notify customers automatically.' : 'Orders still update. Ask Super Admin to connect SMS.'}</p>
          </div>
        </div>
        <div className="sms-status-card">
          <MessageSquareText size={20} />
          <div>
            <small>Connected Provider</small>
            <strong>{connected ? providerName(settings.provider) : 'Not configured'}</strong>
            <p>{connected ? `Sender: ${settings.senderName || 'Verola'}` : 'No provider keys are visible here.'}</p>
          </div>
        </div>
        <div className="sms-status-card">
          <Clock3 size={20} />
          <div>
            <small>Last Sent</small>
            <strong>{lastSent ? `${lastSent.status} · ${lastSent.timestamp}` : 'No SMS yet'}</strong>
            <p>{lastSent ? `${lastSent.recipient} · ${lastSent.templateKey}` : 'Customer updates will appear after status changes.'}</p>
          </div>
        </div>
      </div>
      <button className="sms-test-button" onClick={sendTestSms}>{connected ? 'Send test update' : 'Check SMS status'}</button>
      {notice && <p className="messaging-notice compact">{notice}</p>}
    </div>
  );
}

function SmsUsageLog({ logs }: { logs: SmsLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="empty-roster">
        <MessageSquareText size={22} />
        <strong>No SMS events yet</strong>
        <p>Sent and failed customer updates will appear here by business.</p>
      </div>
    );
  }

  return (
    <div className="sms-log-list">
      {logs.slice(0, 8).map((log) => (
        <div className="sms-log-row" key={log.id}>
          <div>
            <strong>{log.businessName}</strong>
            <span>{log.recipient} · {log.templateKey} · {log.timestamp}</span>
            <small>{log.response}</small>
          </div>
          <span className={log.status === 'sent' ? 'status-dot active' : 'status-dot paused'}>{log.status}</span>
        </div>
      ))}
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

function stageActionCopy(status: JobStatus) {
  const copy: Record<JobStatus, string> = {
    collected: 'Order added to the active queue.',
    in_progress: 'Staff have started processing the job.',
    ready_for_pickup: 'Customer can collect the completed order.',
    completed: 'Order leaves active jobs and moves to history.'
  };
  return copy[status];
}

function renderTemplatePreview(template: string) {
  return template.replace(/\{\{customer\}\}/g, 'Customer').replace(/\{\{business\}\}/g, 'Your Business');
}

function nowLabel(date: Date = new Date()) {
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

function simpleStageLabel(status: JobStatus, workflowStages?: Record<JobStatus, WorkflowStage>) {
  const fallback: Record<JobStatus, string> = {
    collected: 'Received',
    in_progress: 'In Progress',
    ready_for_pickup: 'Ready',
    completed: 'Completed'
  };
  const label = workflowStages?.[status]?.label || fallback[status];
  return status === 'collected' && label === 'Collected' ? 'Received' : label;
}

function simpleStageAction(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    collected: 'Move to Received',
    in_progress: 'Move to In Progress',
    ready_for_pickup: 'Move to Ready',
    completed: 'Complete Order'
  };
  return labels[status];
}

function stageActionLabel(status: JobStatus, workflowStages?: Record<JobStatus, WorkflowStage>) {
  const configured = workflowStages?.[status]?.verb?.trim();
  return configured || simpleStageAction(status);
}

function queueActionLabel(status: JobStatus, workflowStages?: Record<JobStatus, WorkflowStage>) {
  const configured = workflowStages?.[status]?.verb?.trim();
  if (configured && configured !== simpleStageAction(status)) return configured.replace(/^Move to\s+/i, '');
  const labels: Record<JobStatus, string> = {
    collected: 'Received',
    in_progress: 'Start',
    ready_for_pickup: 'Ready',
    completed: 'Complete'
  };
  return labels[status];
}

function simpleOrderFilterMatches(job: Job, filter: SimpleOrderFilter) {
  if (filter === 'collected') return job.status === 'collected';
  if (filter === 'in_progress') return job.status === 'in_progress';
  if (filter === 'ready_for_pickup') return job.status === 'ready_for_pickup';
  return true;
}


function nextJobStatus(status: JobStatus) {
  const index = statusFlow.indexOf(status);
  return index >= 0 && index < statusFlow.length - 1 ? statusFlow[index + 1] : undefined;
}

function assignedStaffForJob(job: Job, staff: StaffMember[]) {
  const activeStaff = staff.filter((member) => member.active);
  if (!activeStaff.length) return 'Unassigned';
  const staffIndex = job.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return activeStaff[staffIndex % activeStaff.length].name;
}

function lastUpdateLabel(job: Job) {
  return job.updates[0]?.at || 'No activity';
}

function completionTime(job: Job) {
  return job.updates.find((update) => update.status === 'completed')?.at || job.paidAt || lastUpdateLabel(job);
}

function operationalSignal(job: Job, notification: JobNotification) {
  if (job.status === 'completed') return { label: 'Collected by customer', tone: 'done' };
  if (job.status === 'ready_for_pickup' && !job.paid) return { label: 'Awaiting payment', tone: 'warn' };
  if (job.status === 'ready_for_pickup') return { label: 'Awaiting collection', tone: 'ready' };
  if (notification.state === 'delivered') return { label: 'Customer notified', tone: 'good' };
  if (notification.state === 'ready') return { label: 'SMS ready to send', tone: 'ready' };
  if (notification.state === 'failed') return { label: 'Message not sent', tone: 'warn' };
  return { label: job.status === 'in_progress' ? 'Work underway' : 'Waiting to start', tone: 'neutral' };
}

function latestNotification(job: Job): JobNotification {
  const sent = job.updates.find((update) => update.kind === 'sms' || update.sms.toLowerCase().includes('customer sms sent'));
  if (sent) {
    return {
      state: 'delivered',
      label: 'SMS delivered',
      time: sent.at,
      message: sent.sms.replace(/^Customer SMS sent(?: via [^:]+)?:\s*/i, '')
    };
  }

  const failed = job.updates.find((update) => update.kind === 'sms_failed' || update.sms.toLowerCase().includes('sms unavailable'));
  if (failed) {
    return {
      state: 'failed',
      label: 'SMS failed',
      time: failed.at,
      message: failed.sms
    };
  }

  const ready = job.updates.find((update) => update.sms.toLowerCase().includes('sms preview ready'));
  if (ready) {
    return {
      state: 'ready',
      label: 'SMS preview ready',
      time: ready.at,
      message: ready.sms.replace(/^Status updated\. SMS preview ready:\s*/i, '')
    };
  }

  const statusMessage = job.updates.find((update) => update.status && update.sms && update.kind !== 'sms_failed');
  if (statusMessage) {
    return {
      state: 'delivered',
      label: 'SMS delivered',
      time: statusMessage.at,
      message: statusMessage.sms
    };
  }

  return {
    state: 'none',
    label: 'No SMS yet',
    time: '',
    message: 'Update a status to prepare a customer message.'
  };
}

function IndustryPresetPicker({
  activeKey,
  applyPreset
}: {
  activeKey: string;
  applyPreset: (presetKey?: string) => void;
}) {
  return (
    <div className="industry-preset-picker">
      <div className="section-mini-heading">
        <strong>Industry quick setup</strong>
        <span>Changes workflow buttons and SMS templates</span>
      </div>
      <div className="industry-preset-grid">
        {industryPresetOptions.map((key) => {
          const preset = industryPresets[key];
          return (
            <button className={key === activeKey ? 'active' : ''} key={key} type="button" onClick={() => applyPreset(key)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          );
        })}
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
    <div className="template-workspace">
      <div className="section-mini-heading">
        <strong>Templates</strong>
        <span>Auto-sent by stage</span>
      </div>
      {statusFlow.map((status) => (
        <details className="template-accordion" key={status}>
          <summary>
            <div>
              <strong>{workflowStages[status].label}</strong>
              <span>{stageActionCopy(status)}</span>
            </div>
            <small>{templates[status].length} chars</small>
          </summary>
          <label>
            <span>Message template</span>
            <textarea value={templates[status]} onChange={(event) => setTemplate(status, event.target.value)} rows={3} />
          </label>
          <div className="template-preview">
            <small>Live preview</small>
            <p>{renderTemplatePreview(templates[status])}</p>
          </div>
          <p className="template-hint">{'Use {{customer}} and {{business}} to personalise this SMS.'}</p>
        </details>
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
    <div className="workflow-stage-board">
      {statusFlow.map((status, index) => (
        <div className="workflow-stage-card" key={status}>
          <div className="workflow-stage-top">
            <div className="stage-number">{index + 1}</div>
            <div>
              <span className="eyebrow">Stage {index + 1}</span>
              <h3>{stages[status].label}</h3>
              <input value={stages[status].label} onChange={(event) => setStage(status, { label: event.target.value })} placeholder="Stage name" aria-label={`${status} stage name`} />
            </div>
            <span className="sms-auto-pill">Uses template</span>
          </div>
          <div className="stage-detail-grid">
            <label>
              <span>Staff button</span>
              <strong>{stages[status].verb}</strong>
              <input value={stages[status].verb} onChange={(event) => setStage(status, { verb: event.target.value })} placeholder="Button label" />
            </label>
            <label>
              <span>Internal meaning</span>
              <strong>{stages[status].nextStep || stageActionCopy(status)}</strong>
              <input value={stages[status].nextStep} onChange={(event) => setStage(status, { nextStep: event.target.value })} placeholder={stageActionCopy(status)} />
            </label>
          </div>
          <p>{stageActionCopy(status)} SMS wording comes from the matching Messaging template.</p>
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
  const notification = job ? latestNotification(job) : undefined;
  const signal = job && notification ? operationalSignal(job, notification) : undefined;

  if (!job) {
    return (
      <div className="job-detail empty">
        <Sparkles size={24} />
        <strong>No matching jobs</strong>
      </div>
    );
  }

  return (
    <aside className="job-detail order-drawer">
      <div className="job-detail-topline">
        <span className="eyebrow">Order details</span>
        {!compact && <a href={`/track/${encodeURIComponent(job.id)}`}>Customer view</a>}
      </div>

      <div className="order-summary-card">
        <div>
          <span>{job.id}</span>
          <h2>{job.customer}</h2>
          <p>{job.phone}</p>
          <strong>{job.item}</strong>
          {signal && <span className={`order-signal ${signal.tone}`}>{signal.label}</span>}
        </div>
        <div className="job-title-badges">
          <PaymentBadge paid={job.paid} />
          <StatusBadge status={job.status} workflowStages={workflowStages} />
        </div>
      </div>

      {notification && (
        <div className={`latest-notification-card ${notification.state}`}>
          <div>
            <span>{notification.state === 'delivered' ? '✓' : notification.state === 'ready' ? '⌛' : notification.state === 'failed' ? '!' : '•'}</span>
            <div>
              <strong>{notification.label}{notification.time ? ` at ${notification.time}` : ''}</strong>
              <p>{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className={job.paid ? 'payment-panel paid' : 'payment-panel'}>
        <div>
          <strong>{job.paid ? 'Payment received' : 'Payment not received'}</strong>
          <p>{job.paid ? `Marked paid ${job.paidAt}` : 'Customer can pay before collection or at pickup.'}</p>
        </div>
        <button onClick={() => toggleJobPaid(job.id)}>{job.paid ? 'Mark unpaid' : 'Mark paid'}</button>
      </div>

      {updateJobStatus && job.status !== 'completed' ? (
        <div className="detail-next-step">
        <div className="detail-section-title">
          <strong>Next step</strong>
          <span>Automatically notifies customer via SMS</span>
        </div>
        <div className="detail-next-card">
          <div>
            <span>Current stage</span>
            <strong>{simpleStageLabel(job.status, workflowStages)}</strong>
          </div>
          {nextJobStatus(job.status) && (
            <button className="primary-simple-action" onClick={() => updateJobStatus(job.id, nextJobStatus(job.status)!)}>
              {queueActionLabel(nextJobStatus(job.status)!, workflowStages)}
            </button>
          )}
        </div>
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
          <div className="detail-section-title">
            <strong>Notes</strong>
            <span>Internal only</span>
          </div>
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
        <div className="detail-section-title">
          <strong>Activity timeline</strong>
          <span>{job.updates.length} updates</span>
        </div>
        {job.updates.map((update, index) => (
          <div className={`timeline-item ${update.kind ?? 'status'}`} key={`${update.status}-${update.at}-${index}`}>
            <span>{update.kind === 'sms' ? <MessageSquareText size={11} /> : update.kind === 'payment' ? <CreditCard size={11} /> : update.kind === 'note' ? <ClipboardList size={11} /> : <Check size={11} />}</span>
            <div>
              <strong>{update.kind === 'sms' ? 'SMS sent' : update.kind === 'sms_failed' ? 'SMS not sent' : update.kind === 'note' ? 'Note added' : update.kind === 'payment' ? 'Payment update' : workflowStages[update.status ?? job.status].label} · {update.at}</strong>
              <p>{update.sms}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
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
  const logoUrl = brand.logoUrl || brand.lightLogoUrl;
  const iconUrl = brand.appIconUrl || brand.logoUrl;

  if (logoUrl) {
    return (
      <div className={`business-logo image-logo ${className}`} style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
        <span>{initials}</span>
        <img className="logo-wordmark" src={logoUrl} alt={`${brand.name} logo`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        {iconUrl && <img className="logo-icon" src={iconUrl} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
      </div>
    );
  }

  return (
    <div className={`business-logo ${className}`} style={{ '--brand': brand.primary, '--accent': brand.accent } as React.CSSProperties}>
      <span>{initials}</span>
    </div>
  );
}

function BusinessLogo({ business, className = '' }: { business: Business; className?: string }) {
  const initials = business.name.split(' ').map((word) => word[0]).join('').slice(0, 2) || 'V';
  const logoUrl = business.logoUrl || platformBrand.logoUrl;
  const iconUrl = business.logoUrl || platformBrand.appIconUrl;

  if (logoUrl) {
    return (
      <div className={`business-logo image-logo ${className}`} style={{ '--brand': business.primary, '--accent': business.accent } as React.CSSProperties}>
        <span>{initials}</span>
        <img className="logo-wordmark" src={logoUrl} alt={`${business.name} logo`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        {iconUrl && <img className="logo-icon" src={iconUrl} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
      </div>
    );
  }

  return (
    <div className={`business-logo ${className}`} style={{ '--brand': business.primary, '--accent': business.accent } as React.CSSProperties}>
      <span>{initials}</span>
    </div>
  );
}

function StatusBadge({ status, workflowStages }: { status: JobStatus; workflowStages: Record<JobStatus, WorkflowStage> }) {
  return <span className={`status-badge ${workflowStages[status].tone}`}>{simpleStageLabel(status, workflowStages)}</span>;
}

function PaymentBadge({ paid }: { paid: boolean }) {
  return <span className={paid ? 'payment-badge paid' : 'payment-badge unpaid'}>{paid ? 'Paid' : 'Unpaid'}</span>;
}

export default App;
