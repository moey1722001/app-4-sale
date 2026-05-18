import { Account, Client, Databases, Functions, Storage, Teams } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined;

export const appwriteDatabaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined;

export const hasAppwriteConfig = Boolean(endpoint && projectId && appwriteDatabaseId);

export const appwriteClient = new Client();

if (endpoint && projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(appwriteClient);
export const databases = new Databases(appwriteClient);
export const functions = new Functions(appwriteClient);
export const storage = new Storage(appwriteClient);
export const teams = new Teams(appwriteClient);
