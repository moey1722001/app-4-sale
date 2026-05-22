import { Account, Client, Databases, Functions, Storage, Teams } from 'appwrite';

// Fall back to the syd regional endpoint to avoid "Project is not accessible in this region" errors
// when VITE_APPWRITE_ENDPOINT is missing from Vercel env vars (SDK default is global cloud.appwrite.io)
const endpoint = (import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined) || 'https://syd.cloud.appwrite.io/v1';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined;

export const appwriteDatabaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined;
export const appwriteOrganisationCollectionId = (import.meta.env.VITE_APPWRITE_ORGANISATION_COLLECTION_ID as string | undefined) || 'organisations';
const configuredInviteFunctionId = import.meta.env.VITE_APPWRITE_INVITE_FUNCTION_ID as string | undefined;
export const appwriteInviteFunctionId = configuredInviteFunctionId === '6a0f5ee79aa7bce5c892'
  ? '6a0f5ee400325b40b2e9'
  : configuredInviteFunctionId;
export const appwriteLogoBucketId = import.meta.env.VITE_APPWRITE_LOGO_BUCKET_ID as string | undefined;
export const appBaseUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');

export const hasAppwriteConfig = Boolean(projectId && appwriteDatabaseId);

export const appwriteClient = new Client();

if (projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(appwriteClient);
export const databases = new Databases(appwriteClient);
export const functions = new Functions(appwriteClient);
export const storage = new Storage(appwriteClient);
export const teams = new Teams(appwriteClient);
