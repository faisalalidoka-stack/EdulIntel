import React, { useState, useEffect } from "react";
import { Cloud, Lock, LogIn, LogOut, Loader2, RefreshCw, FileText, Trash2, Database, UploadCloud } from "lucide-react";
import { DriveFile, listDriveFiles, getDriveFileContent, deleteFileFromDrive, googleSignIn, logout } from "../lib/driveService";

interface GoogleDriveProps {
  currentUser: any;
  accessToken: string | null;
  onLoginSuccess: (user: any, token: string) => void;
  onLogoutSuccess: () => void;
}

export default function GoogleDrive({ currentUser, accessToken, onLoginSuccess, onLogoutSuccess }: GoogleDriveProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        onLoginSuccess(res.user, res.accessToken);
        setSyncStatus("Successfully connected to Google Workspace!");
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to connect: please ensure Firebase and Google Client OAuth configurations are in place.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logout();
      onLogoutSuccess();
      setFiles([]);
      setSyncStatus("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const list = await listDriveFiles(accessToken, searchQuery);
      setFiles(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadFiles();
    }
  }, [accessToken, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm("Are you sure you want to delete this file from your Google Drive?")) return;
    setLoading(true);
    try {
      await deleteFileFromDrive(accessToken, id);
      setFiles(files.filter(f => f.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" /> Google Drive Cloud Hub
          </h2>
          <p className="text-xs text-slate-500">
            Securely back up your compiled reports, sync data models, and integrate educational artifacts with Google Workspace.
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-bold text-slate-800 block">{currentUser.displayName || "Google User"}</span>
                <span className="text-[10px] text-slate-400 block">{currentUser.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              >
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="w-4 h-4" /> Connect Google Drive
            </button>
          )}
        </div>
      </div>

      {syncStatus && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-3 rounded-xl text-xs font-bold">
          {syncStatus}
        </div>
      )}

      {accessToken ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-3xs p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" /> Synced Drive Files & Reports
            </h3>
            
            {/* Search Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Drive files..."
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold text-slate-800"
              />
              <button 
                onClick={loadFiles}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">Querying Google Workspace drive directories...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files.map((file) => (
                <div key={file.id} className="bg-slate-50/50 hover:bg-white hover:border-slate-300 border border-slate-200 p-5 rounded-2xl transition-all flex items-start justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 line-clamp-1">{file.name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">{file.mimeType}</p>
                      {file.size && <p className="text-[9px] text-slate-400 font-mono">{(parseInt(file.size) / 1024).toFixed(1)} KB</p>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(file.id)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <UploadCloud className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">No files found in Google Drive</p>
              <p className="text-[10px] text-slate-400">Back up some reports or upload student spreadsheets to view them here.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-3xs">
          <Lock className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Workspace Authentication Required</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Connecting Google Drive permits EduIntel AI to back up your custom student guides, generated trends, and comprehensive system briefs directly in your cloud storage.
          </p>
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 mx-auto transition-all cursor-pointer shadow-sm"
          >
            <LogIn className="w-4 h-4" /> Auth Workspace
          </button>
        </div>
      )}
    </div>
  );
}
