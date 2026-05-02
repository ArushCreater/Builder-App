import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useToast } from '../../components/ui/use-toast';
import {
  Folder,
  FolderOpen,
  Image,
  Upload,
  Plus,
  ChevronRight,
  AlertCircle,
  Camera,
  ImagePlus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface OdItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string | null;
  webUrl?: string;
  createdAt?: string;
}

interface Project {
  id: string;
  name: string;
  status?: string;
}

const isImage = (item: OdItem) =>
  item.type === 'file' && (item.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(item.name));

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImagesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Current browsing path relative to BuilderApp/Images/
  // e.g. '' = root, 'ProjectName' = inside a project folder
  const [path, setPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Breadcrumb segments: ['ProjectName', 'SubFolder']
  const segments = path ? path.split('/') : [];
  const browsePath = path ? `Images/${path}` : 'Images';

  // Check if OneDrive is configured
  const { data: statusData } = useQuery({
    queryKey: ['onedrive-status'],
    queryFn: () => apiClient.get<{ configured: boolean; needsAuth?: boolean }>('/onedrive/status'),
    staleTime: 60_000,
  });
  const configured = statusData?.configured ?? false;
  const needsAuth = statusData?.needsAuth ?? false;

  // Fetch projects so we can show project folders at root
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<{ projects: Project[] }>('/projects'),
    enabled: configured,
  });
  const projects = projectsData?.projects || [];

  // Browse current folder
  const {
    data: browseData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['onedrive-browse', browsePath],
    queryFn: () => apiClient.get<{ items: OdItem[] }>(`/onedrive/browse?path=${encodeURIComponent(browsePath)}`),
    enabled: configured,
  });
  const items = browseData?.items || [];

  // Fetch thumbnail URLs for image items (lazy, one at a time)
  const fetchThumbnail = useCallback(
    async (item: OdItem) => {
      if (!isImage(item) || thumbnails[item.id]) return;
      try {
        const data = await apiClient.get<{ url: string | null }>(`/onedrive/thumbnail/${item.id}`);
        if (data.url) setThumbnails(prev => ({ ...prev, [item.id]: data.url! }));
      } catch {
        // silently ignore
      }
    },
    [thumbnails]
  );

  // Folder creation
  const createFolderMutation = useMutation({
    mutationFn: ({ folderPath, name }: { folderPath: string; name: string }) =>
      apiClient.post('/onedrive/folder', { path: folderPath, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      setShowNewFolder(false);
      setNewFolderName('');
      toast({ title: 'Folder created' });
    },
    onError: (err: any) => {
      const msg = err.message?.includes('409') ? 'A folder with that name already exists' : (err.message || 'Failed to create folder');
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  // File upload
  const uploadMutation = useMutation({
    mutationFn: async ({ file, uploadPath }: { file: File; uploadPath: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', uploadPath);
      const baseUrl = ((import.meta as any)?.env?.VITE_API_URL as string) || 'http://localhost:8081';
      const response = await fetch(`${baseUrl}/api/onedrive/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      setUploadDialogOpen(false);
      toast({ title: 'Image uploaded' });
    },
    onError: (err: any) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    },
  });

  // Delete item
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/onedrive/item/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      setDeletingId(null);
      toast({ title: 'Deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileInput = (file: File | null | undefined) => {
    if (!file) return;
    uploadMutation.mutate({ file, uploadPath: browsePath });
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const folderPath = path ? `Images/${path}` : 'Images';
    createFolderMutation.mutate({ folderPath, name });
  };

  const navigate = (item: OdItem) => {
    if (item.type !== 'folder') return;
    setPath(prev => (prev ? `${prev}/${item.name}` : item.name));
  };

  const navigateTo = (index: number) => {
    // index = -1 → root, 0 → first segment, etc.
    if (index < 0) setPath('');
    else setPath(segments.slice(0, index + 1).join('/'));
  };

  // At root level, show a project-folder for every project (ensure they exist)
  // plus any extra folders browsed from OneDrive
  const displayItems: OdItem[] = path === ''
    ? [
        // Merge OneDrive folders with project list so unseen projects appear too
        ...projects
          .filter(p => !items.some(i => i.type === 'folder' && i.name === p.name))
          .map(p => ({
            id: `proj-${p.id}`,
            name: p.name,
            type: 'folder' as const,
          })),
        ...items,
      ].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      })
    : [...items].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });

  // ── Not configured banner ──────────────────────────────────────────────────
  if (!configured) {
    const backendUrl = ((import.meta as any)?.env?.VITE_API_URL as string) || 'https://srv-d7jgoefavr4c73c9n8k0.onrender.com';
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Images</h1>
          <p className="text-gray-500 mt-1">Store and manage project photos in OneDrive</p>
        </div>
        {needsAuth ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-8 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
              <Image className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-indigo-900 text-lg">Connect your OneDrive</p>
              <p className="text-sm text-indigo-700 mt-1">
                Sign in with your Microsoft account to enable photo storage for all projects.
              </p>
            </div>
            <a
              href={`${backendUrl}/api/onedrive/auth`}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full px-6 py-2.5 transition-colors text-sm"
            >
              <Upload className="h-4 w-4" />
              Connect OneDrive
            </a>
            <p className="text-xs text-indigo-500">
              You'll be redirected to Microsoft to sign in, then brought back here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex gap-4 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">OneDrive not configured</p>
              <p className="text-sm text-amber-800 mt-1">
                Set the Azure App Registration credentials on your backend server (Render dashboard):
              </p>
              <pre className="mt-3 text-xs bg-amber-100 rounded-lg p-3 text-amber-900 font-mono whitespace-pre-wrap">
{`AZURE_CLIENT_ID=<your-app-registration-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>`}
              </pre>
              <p className="text-xs text-amber-700 mt-3">
                Once set and redeployed, this page will show a "Connect OneDrive" button to complete the setup.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Images</h1>
          <p className="text-gray-500 mt-1">Project photo library — stored in OneDrive</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Folder
          </Button>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Upload Image
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm flex-wrap">
        <button
          onClick={() => navigateTo(-1)}
          className={cn(
            'font-medium hover:text-indigo-600 transition-colors',
            path === '' ? 'text-indigo-600' : 'text-slate-600'
          )}
        >
          Images
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => navigateTo(i)}
              className={cn(
                'font-medium hover:text-indigo-600 transition-colors',
                i === segments.length - 1 ? 'text-indigo-600' : 'text-slate-600'
              )}
            >
              {seg}
            </button>
          </span>
        ))}
      </nav>

      {/* New folder inline form */}
      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />
          <Input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-8 flex-1 max-w-xs"
          />
          <Button type="submit" size="sm" disabled={createFolderMutation.isPending || !newFolderName.trim()}>
            {createFolderMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}>
            Cancel
          </Button>
        </form>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl bg-slate-100 aspect-square animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-slate-500">Failed to load folder contents</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          {path ? (
            <>
              <ImagePlus className="h-12 w-12 text-slate-300" />
              <p className="text-slate-500 font-medium">This folder is empty</p>
              <p className="text-slate-400 text-sm">Upload images or create a subfolder</p>
            </>
          ) : (
            <>
              <FolderOpen className="h-12 w-12 text-slate-300" />
              <p className="text-slate-500 font-medium">No projects yet</p>
              <p className="text-slate-400 text-sm">Create a project first — its folder will appear here</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayItems.map(item => (
            <div
              key={item.id}
              className={cn(
                'group relative rounded-xl border border-slate-200 bg-white overflow-hidden transition-all',
                item.type === 'folder' ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md' : 'hover:shadow-md',
              )}
              onClick={() => item.type === 'folder' && navigate(item)}
              onMouseEnter={() => isImage(item) && fetchThumbnail(item)}
            >
              {/* Thumbnail / icon area */}
              <div className="aspect-square flex items-center justify-center bg-slate-50">
                {item.type === 'folder' ? (
                  <Folder className="h-16 w-16 text-indigo-400" />
                ) : thumbnails[item.id] ? (
                  <img
                    src={thumbnails[item.id]}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={() => setThumbnails(prev => { const next = { ...prev }; delete next[item.id]; return next; })}
                  />
                ) : isImage(item) ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <Image className="h-12 w-12 text-slate-300" />
                  </div>
                ) : (
                  <Image className="h-12 w-12 text-slate-300" />
                )}
              </div>

              {/* Label */}
              <div className="px-2 py-1.5 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-800 truncate" title={item.name}>
                  {item.name}
                </p>
                {item.size !== undefined && (
                  <p className="text-[10px] text-slate-400">{formatBytes(item.size)}</p>
                )}
              </div>

              {/* Delete button (only for real OneDrive items, not virtual proj folders) */}
              {!item.id.startsWith('proj-') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(item.id);
                    deleteMutation.mutate(item.id);
                  }}
                  disabled={deletingId === item.id}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-white/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-slate-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>
          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500">Uploading to OneDrive…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              {/* Hidden file inputs */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFileInput(e.target.files?.[0])}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  files.forEach(f => uploadMutation.mutate({ file: f, uploadPath: browsePath }));
                }}
              />

              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-4 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left"
              >
                <Camera className="h-8 w-8 text-indigo-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Take a Photo</p>
                  <p className="text-xs text-slate-500">Use your camera</p>
                </div>
              </button>

              <button
                onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-4 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left"
              >
                <ImagePlus className="h-8 w-8 text-indigo-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Choose from Library</p>
                  <p className="text-xs text-slate-500">Select one or more images</p>
                </div>
              </button>

              <p className="text-[11px] text-center text-slate-400 mt-1">
                Uploading to: <span className="font-mono">OneDrive / {browsePath}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ImagesPage;
