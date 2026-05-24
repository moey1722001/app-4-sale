import { Account, Client, Databases, Functions, Query, Storage, Teams } from 'appwrite';

const APPWRITE_ENDPOINT = 'https://syd.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '6a0ae5450036ec146492';

// Allow env var overrides for local/staging environments
const endpoint = (import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined) || APPWRITE_ENDPOINT;
const projectId = (import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined) || APPWRITE_PROJECT_ID;

export const appwriteDatabaseId = (import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined) || 'verola';
export const appwriteOrganisationCollectionId = (import.meta.env.VITE_APPWRITE_ORGANISATION_COLLECTION_ID as string | undefined) || 'organisations';
const configuredInviteFunctionId = import.meta.env.VITE_APPWRITE_INVITE_FUNCTION_ID as string | undefined;
export const appwriteInviteFunctionId = configuredInviteFunctionId === '6a0f5ee79aa7bce5c892'
  ? '6a0f5ee400325b40b2e9'
  : configuredInviteFunctionId;
export const appwriteSmsFunctionId = import.meta.env.VITE_APPWRITE_SMS_FUNCTION_ID as string | undefined;
export const appwriteLogoBucketId = import.meta.env.VITE_APPWRITE_LOGO_BUCKET_ID as string | undefined;
export const appBaseUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');

export const hasAppwriteConfig = true;

export const appwriteClient = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

export const account = new Account(appwriteClient);
export const databases = new Databases(appwriteClient);
export const functions = new Functions(appwriteClient);
export const storage = new Storage(appwriteClient);
export const teams = new Teams(appwriteClient);
export { Query };
