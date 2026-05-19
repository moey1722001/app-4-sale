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
import { appBaseUrl, appwriteInviteFunctionId, functions, hasAppwriteConfig } from './lib/appwrite';

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

const demoUsers: AuthUser[] = [
  { email: 'moey1722001@gmail.com', name: 'Platform Owner', role: 'super' },
  { email: 'owner@freshfold.test', name: 'Fresh Fold Admin', role: 'admin', businessId: 'fresh-fold' },
  { email: 'admin@rapidauto.test', name: 'Rapid Auto Admin', role: 'admin', businessId: 'rapid-auto' },
  { email: 'mia@freshfold.test', name: 'Mia Taylor', role: 'staff', businessId: 'fresh-fold' }
];

const demoSuperAdminPasswordHash = '6d7c8cf940fcbb15e4a46bb697fd8560022500ffe874e50117a292f8cbc6a469';

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
    createdAt: new Date().toISOString(),
    expiresAt: addDays(new Date(), 14)
  };
}

function buildInviteUrl(invite: OrganisationInvite) {
  const baseUrl = appBaseUrl || window.location.origin;
  return `${baseUrl}/invite/${encodeURIComponent(invite.token)}`;
}

async function passwordDigest(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function App() {
  const initialPath = getInitialPath();
  const [portal, setPortal] = useState<Portal>(() => portalFromPath(initialPath));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginRole, setLoginRole] = useState<UserRole>(() => portalFromPath(initialPath));
  const [loginEmail, setLoginEmail] = useState('moey1722001@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [copiedInviteId, setCopiedInviteId] = useState('');
  const [inviteSendingId, setInviteSendingId] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>(() => readStoredArray(businessStorageKey, initialBusinesses));
  const [activeBusinessId, setActiveBusinessId] = useState('fresh-fold');
  const [jobs, setJobs] = useState(seedJobs);
  const [rosterShifts, setRosterShifts] = useState(seedRosterShifts);
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
  const [workflowStages, setWorkflowStages] = useState(defaultWorkflowStages);
  const [smsNotice, setSmsNotice] = useState('');
  const [smsPreview, setSmsPreview] = useState<SmsPreview | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, { provider: SmsProvider; senderName: string; username: string; apiKey: string; fromNumber: string }>>({});
  const [smsTemplates, setSmsTemplates] = useState<Record<JobStatus, string>>({
    collected: 'Hi {{customer}}, {{business}} has received your order. We will update you soon.',
    in_progress: 'Hi {{customer}}, your order at {{business}} is now in progress.',
    ready_for_pickup: 'Hi {{customer}}, your order is ready for pickup at {{business}}.',
    completed: 'Thanks {{customer}}. Your order with {{business}} is complete.'
  });

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
  const activeInviteToken = inviteTokenFromPath(currentPath);
  const activeInvite = activeInviteToken ? organisationInvites.find((invite) => invite.token === activeInviteToken) ?? inviteFromUrl(activeInviteToken) : undefined;

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
    if (authUser.role !== portal) {
      setPortal(authUser.role);
      window.history.replaceState({}, '', portalPaths[authUser.role]);
    }
    if ((authUser.role === 'admin' || authUser.role === 'staff') && authUser.businessId) {
      setActiveBusinessId(authUser.businessId);
    }
  }, [authUser, portal]);

  function openPortal(nextPortal: Portal) {
    if (authUser && authUser.role !== nextPortal) return;
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
    const user = [...demoUsers, ...createdUsers].find((candidate) => candidate.email === email && candidate.role === loginRole);
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
    setPortal('admin');
    setLoginRole('admin');
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
    const url = buildInviteUrl(invite);
    const subject = `Set up ${invite.businessName} in Verola`;
    const body = [
      `Hi,`,
      ``,
      `You have been invited to set up ${invite.businessName} in Verola.`,
      ``,
      `Open your invite link:`,
      url,
      ``,
      `This invite gives you Business Admin access for ${invite.businessName}.`
    ].join('\n');

    setInviteSendingId(invite.id);
    setInviteNotice('');

    try {
      if (hasAppwriteConfig && appwriteInviteFunctionId) {
        await functions.createExecution(
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
            expiresAt: invite.expiresAt
          }),
          false,
          '/',
          ExecutionMethod.POST,
          { 'content-type': 'application/json' }
        );
        setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email sent just now' } : item)));
        setInviteNotice(`Invite email sent to ${invite.adminEmail}.`);
        debugInvite('invite email sent', { token: invite.token, businessId: invite.businessId });
        return;
      }

      await navigator.clipboard?.writeText(`${subject}\n\n${body}`);
      setCopiedInviteId(invite.id);
      setInviteNotice('Email sending is not configured. Copy and send the invite link manually.');
      debugInvite('email sending unavailable, invite copied', { token: invite.token, businessId: invite.businessId });
    } catch {
      await navigator.clipboard?.writeText(url);
      setCopiedInviteId(invite.id);
      setOrganisationInvites((current) => current.map((item) => (item.id === invite.id ? { ...item, sentAt: 'Email failed - link copied' } : item)));
      setInviteNotice('Invite email could not be sent. The link was copied instead.');
    } finally {
      setInviteSendingId('');
    }
  }

  async function sendInviteEmail(inviteId: string) {
    const invite = organisationInvites.find((item) => item.id === inviteId);
    if (!invite) return;
    await sendInviteEmailForInvite(invite);
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
        await functions.createExecution(
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
      }
    } catch {
      setSetupDraft((current) => ({ ...current, error: 'Setup could not be completed. Please try again or ask for a new invite.' }));
      debugInvite('invite accept failed', { token: invite.token, businessId: invite.businessId });
      return;
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

  function deleteBusiness(businessId: string) {
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
  }

  function uploadBusinessLogo(businessId: string, file?: File) {
    if (!file) return;
    setBusinesses((current) =>
      current.map((business) =>
        business.id === businessId
          ? {
              ...business,
              logoName: file.name,
              logoUrl: URL.createObjectURL(file)
            }
          : business
      )
    );
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

  function addJob() {
    if (!newCustomer.trim() || !newPhone.trim()) return;

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
      <InviteAcceptView
        invite={activeInvite}
        setupDraft={setupDraft}
        setSetupDraft={setSetupDraft}
        completeInviteSetup={completeInviteSetup}
      />
    );
  }

  if (!authUser) {
    return (
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
    );
  }

  return (
    <div className="app-shell" style={{ '--brand': activeBusiness.primary, '--accent': activeBusiness.accent } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="logo-mark">V</div>
          <div>
            <strong>Verola</strong>
            <span>Workflow SMS SaaS</span>
          </div>
        </div>

        <nav className="portal-switcher" aria-label="Portal">
          {([authUser.role] as Portal[]).map((key) => {
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
          <span className="eyebrow">White-label tenant</span>
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
          <div>
            <span className="eyebrow">{portalMeta[portal].label}</span>
            <h1>{portal === 'super' ? 'Platform command centre' : portal === 'admin' ? 'Business workflow hub' : 'Today’s jobs'}</h1>
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
          <SmsPreviewModal preview={smsPreview} provider={activeBusiness.smsProvider} onSend={sendPreviewSms} onClose={() => setSmsPreview(null)} />
        )}
      </main>
    </div>
  );
}

function SuperAdminView({
  businesses: tenants,
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
  uploadBusinessLogo
}: {
  businesses: Business[];
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
}) {
  const activeTenants = tenants.filter((tenant) => tenant.active).length;
  const connectedMessagingTenants = tenants.filter((tenant) => tenant.messagingEnabled).length;

  return (
    <div className="view-grid">
      <section className="metric-grid">
        <Metric icon={Building2} label="Organisations" value={tenants.length.toString()} detail={`${activeTenants} enabled`} />
        <Metric icon={MessageSquareText} label="BYO providers" value={`${connectedMessagingTenants}/${tenants.length}`} detail="Businesses connected" />
        <Metric icon={CreditCard} label="MRR" value="$7.4k" detail="Subscriptions healthy" />
        <Metric icon={Activity} label="Jobs today" value={tenants.reduce((sum, tenant) => sum + tenant.jobs, 0).toString()} detail="Live workflow volume" />
      </section>

      <section className="panel wide">
        <PanelHeader icon={Settings} title="Business Management" />
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
        <div className="tenant-list">
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
              <div>
                <strong>{tenant.name}</strong>
                <span>{tenant.industry} · {tenant.location}</span>
              </div>
              <div className="tenant-actions">
                <div className="tenant-meta">
                  <span>{tenant.plan}</span>
                  <span className={tenant.active ? 'status-dot active' : 'status-dot paused'}>
                    {tenant.active ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button
                  className="tenant-delete"
                  disabled={tenants.length <= 1}
                  aria-label={`Delete ${tenant.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteBusiness(tenant.id);
                  }}
                >
                  <X size={16} />
                  Delete
                </button>
              </div>
              <ChevronRight size={18} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Mail} title="Company Invites" action={`${organisationInvites.filter((invite) => inviteStatus(invite) === 'pending').length} pending`} />
        {inviteNotice && <div className="inline-notice">{inviteNotice}</div>}
        <div className="invite-list">
          {organisationInvites.map((invite) => (
            <div className="invite-row" key={invite.id}>
              <div>
                <strong>{invite.businessName}</strong>
                <span>{invite.contactName} · {invite.phone || 'No phone yet'}</span>
                <span>{invite.adminEmail}</span>
                <span>Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span>
                <a href={buildInviteUrl(invite)}>{buildInviteUrl(invite)}</a>
              </div>
              <div className="invite-actions">
                <span className={inviteStatus(invite) === 'accepted' ? 'status-dot active' : inviteStatus(invite) === 'expired' ? 'status-dot paused' : 'status-dot pending'}>{inviteStatus(invite)}</span>
                {appwriteInviteFunctionId ? (
                  <button onClick={() => sendInviteEmail(invite.id)} disabled={inviteSendingId === invite.id || inviteStatus(invite) !== 'pending'}>
                    {inviteSendingId === invite.id ? 'Sending' : invite.sentAt.includes('sent') ? 'Resend email' : 'Send email'}
                  </button>
                ) : (
                  <span className="invite-hint">Email not configured</span>
                )}
                <button onClick={() => copyInviteLink(invite.id)}>{copiedInviteId === invite.id ? 'Copied' : 'Copy link'}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel spotlight-panel">
        <PanelHeader icon={Paintbrush} title="Logo & Brand Control" />
        <div className="brand-command">
          <BusinessLogo business={activeBusiness} className="super-logo" />
          <div>
            <strong>{activeBusiness.name}</strong>
            <p>{activeBusiness.logoName ? `Uploaded logo: ${activeBusiness.logoName}` : 'No logo uploaded yet.'}</p>
          </div>
        </div>
        <label className="logo-upload">
          <input type="file" accept="image/*" onChange={(event) => uploadBusinessLogo(activeBusiness.id, event.target.files?.[0])} />
          <Paintbrush size={17} />
          Upload logo
        </label>
        <div className="settings-stack">
          <Setting label="Default sender ID" value="VEROLA" />
          <Setting label="Fallback primary colour" value="#0f766e" />
          <Setting label="Logo policy" value="Super Admin upload only" />
          <Setting label="Disabled org access" value="Blocked at Appwrite permissions" />
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
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <div className="logo-mark">V</div>
          <div>
            <strong>Verola</strong>
            <span>Secure tenant login</span>
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
              <button key={key} className={role === key ? 'active' : ''} onClick={() => setRole(key)}>
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
  const status = invite ? inviteStatus(invite) : undefined;
  const unavailableTitle = status === 'accepted' ? 'Invite already used' : status === 'expired' ? 'Invite expired' : 'Link unavailable';
  const unavailableCopy = status === 'accepted'
    ? 'This setup link has already been accepted. Sign in with the business admin account instead.'
    : status === 'expired'
      ? 'This setup link has expired. Ask the platform owner to send a new invite.'
      : 'This invite token is invalid or could not be found.';

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <div className="logo-mark">V</div>
          <div>
            <strong>Verola</strong>
            <span>Company setup invite</span>
          </div>
        </div>
        {invite && status === 'pending' ? (
          <>
            <div>
              <span className="eyebrow">Business Setup</span>
              <h1>{invite.businessName}</h1>
              <p className="login-copy">Confirm the details, create your admin login, and Verola will open your business dashboard.</p>
            </div>
            <div className="login-help">
              <strong>Invite verified</strong>
              <span>Dashboard: Business Admin</span>
              <span>Organisation: {invite.businessName}</span>
              <span>Email: {invite.adminEmail}</span>
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
  return (
    <div className="view-grid">
      <section className="metric-grid">
        <Metric icon={Clock3} label="Open jobs" value={props.jobs.filter((job) => job.status !== 'completed').length.toString()} detail="Needs action" />
        <Metric icon={ClipboardList} label="Ready pickup" value={props.jobs.filter((job) => job.status === 'ready_for_pickup').length.toString()} detail="Customers waiting" />
        <Metric icon={CreditCard} label="Unpaid jobs" value={props.jobs.filter((job) => !job.paid).length.toString()} detail="Collect when ready" />
        <Metric icon={CalendarClock} label="Roster replies" value={props.rosterShifts.filter((shift) => shift.response === 'accepted').length.toString()} detail={`${props.rosterShifts.filter((shift) => shift.response === 'sent').length} waiting`} />
      </section>

      <section className="panel create-job">
        <PanelHeader icon={Plus} title="Create Customer Job" />
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

      <section className="panel wide">
        <JobsHeader query={props.query} setQuery={props.setQuery} />
        <div className="workflow-layout">
          <WorkflowBoard jobs={props.jobs} selectedJobId={props.selectedJob?.id} setSelectedJobId={props.setSelectedJobId} workflowStages={props.workflowStages} />
          <JobDetail job={props.selectedJob} updateJobStatus={props.updateJobStatus} addJobNote={props.addJobNote} toggleJobPaid={props.toggleJobPaid} workflowStages={props.workflowStages} />
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Settings} title="Workflow Stages" action="Custom" />
        <WorkflowStageEditor stages={props.workflowStages} setStage={props.setWorkflowStage} />
      </section>

      <section className="panel wide">
        <PanelHeader icon={CalendarPlus} title="Rostering" action={`${props.rosterShifts.filter((shift) => shift.response === 'sent').length} pending`} />
        <RosterPlanner
          staff={props.staff}
          shifts={props.rosterShifts}
          draft={props.rosterDraft}
          setDraft={props.setRosterDraft}
          addShift={props.addRosterShift}
          deleteShift={props.deleteRosterShift}
        />
      </section>

      <section className="panel">
        <PanelHeader icon={MessageSquareText} title="Messaging Settings" action={props.business.smsSetupStatus === 'connected' ? 'Connected' : 'Not configured'} />
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
      </section>

      <section className="panel">
        <PanelHeader icon={MessageSquareText} title="SMS Templates" action={props.business.messagingEnabled ? 'Auto-save' : 'Disabled until connected'} />
        <SmsTemplateEditor templates={props.smsTemplates} setTemplate={props.setSmsTemplate} workflowStages={props.workflowStages} />
      </section>

      <section className="panel">
        <PanelHeader icon={UserPlus} title="Staff Access" action={`${props.staff.length} users`} />
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
      </section>

      <section className="panel">
        <PanelHeader icon={CalendarClock} title="Shift Clock" action={`${props.staff.filter((member) => member.clockedIn).length} live`} />
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
  onClose
}: {
  preview: SmsPreview;
  provider: SmsProvider | null;
  onSend: () => void;
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

function BusinessLogo({ business, className = '' }: { business: Business; className?: string }) {
  const initials = business.name.split(' ').map((word) => word[0]).join('').slice(0, 2);

  return (
    <div className={`business-logo ${className}`}>
      {business.logoUrl ? <img src={business.logoUrl} alt={`${business.name} logo`} /> : initials}
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
