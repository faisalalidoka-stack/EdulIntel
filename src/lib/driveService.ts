import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Drive scopes
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we have a user but no cached token (e.g. reload), 
        // we force them to sign in again to obtain a valid access token.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get current cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Sign out
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// --- Google Drive API Handlers ---

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
}

// List files from Google Drive
export const listDriveFiles = async (accessToken: string, queryText: string = ''): Promise<DriveFile[]> => {
  try {
    let q = "trashed = false";
    if (queryText) {
      q += ` and name contains '${queryText.replace(/'/g, "\\'")}'`;
    }
    
    // Construct the query to search for CSVs, Text files, and JSONs for UNEB data ingestion, or general files
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime, thumbnailLink)');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set('pageSize', '40');

    const res = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive list error: ${res.statusText} (${errText})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Failed to list Drive files:', error);
    throw error;
  }
};

// Get the plain text contents of a file (CSV, TXT, JSON etc.)
export const getDriveFileContent = async (accessToken: string, fileId: string): Promise<string> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive get content error: ${res.statusText} (${errText})`);
    }

    return await res.text();
  } catch (error) {
    console.error('Failed to get Drive file contents:', error);
    throw error;
  }
};

// Create and save file to Google Drive (Two-step upload process)
export const saveFileToDrive = async (
  accessToken: string,
  filename: string,
  content: string,
  mimeType: string = 'text/csv'
): Promise<DriveFile> => {
  try {
    // 1. Create file metadata
    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: filename,
        mimeType: mimeType
      })
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Drive create metadata error: ${metaRes.statusText} (${errText})`);
    }

    const meta = await metaRes.json();
    const fileId = meta.id;

    // 2. Upload file contents
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType
      },
      body: content
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Drive media upload error: ${uploadRes.statusText} (${errText})`);
    }

    return await uploadRes.json();
  } catch (error) {
    console.error('Failed to save file to Google Drive:', error);
    throw error;
  }
};

// Delete a file from Google Drive
export const deleteFileFromDrive = async (accessToken: string, fileId: string): Promise<void> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive delete error: ${res.statusText} (${errText})`);
    }
  } catch (error) {
    console.error('Failed to delete file from Google Drive:', error);
    throw error;
  }
};
