import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { supabase } from '../../lib/supabase';
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
  ChevronLeft,
  AlertCircle,
  Camera,
  ImagePlus,
  Trash2,
  RefreshCw,
  X,
  Download,
  ExternalLink,
  ZoomIn,
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

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Lightbox ────────────────────────────────────────────────────────────────
interface LightboxProps {
  item: OdItem;
  src: string;
  allImages: OdItem[];
  thumbnails: Record<string, string>;
  onClose: () => void;
  onNavigate: (item: OdItem) => void;
  onDelete: (item: OdItem) => void;
  isDeleting: boolean;
}

function Lightbox({ item, src, allImages, thumbnails, onClose, onNavigate, onDelete, isDeleting }: LightboxProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const idx = allImages.findIndex(i => i.id === item.id);
  const hasPrev = idx > 0;
  const hasNext = idx < allImages.length - 1;

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [item.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allImages[idx - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allImages[idx + 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, idx, allImages, onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {allImages.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium">
          {idx + 1} / {allImages.length}
        </div>
      )}

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(allImages[idx - 1]); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all hover:scale-110"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(allImages[idx + 1]); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all hover:scale-110"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="flex items-center justify-center px-16 py-16 w-full h-full"
        onClick={e => e.stopPropagation()}
      >
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
        {imgError ? (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <Image className="h-16 w-16" />
            <p className="text-sm">Could not load image</p>
          </div>
        ) : (
          <img
            key={item.id}
            src={src}
            alt={item.name}
            className={cn(
              'max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-opacity duration-300',
              imgLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{ maxHeight: 'calc(100vh - 160px)', maxWidth: 'calc(100vw - 128px)' }}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgLoaded(true); setImgError(true); }}
          />
        )}
      </div>

      {/* Bottom info bar */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-white font-semibold truncate text-sm">{item.name}</p>
          <p className="text-white/50 text-xs mt-0.5">
            {[formatBytes(item.size), formatDate(item.createdAt)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {item.webUrl && (
            <a
              href={item.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              title="Open in OneDrive"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {item.webUrl && (
            <a
              href={item.webUrl}
              download={item.name}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => onDelete(item)}
            disabled={isDeleting}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-red-500/60 flex items-center justify-center text-white transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filmstrip */}
      {allImages.length > 1 && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.stopPropagation()}
        >
          {allImages.map((img) => (
            <button
              key={img.id}
              onClick={() => onNavigate(img)}
              className={cn(
                'h-10 w-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                img.id === item.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              {thumbnails[img.id] ? (
                <img src={thumbnails[img.id]} alt={img.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <Image className="h-4 w-4 text-white/50" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function ImagesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initial path can come from ?path= so links from other pages can deep-link into a folder
  const initialPath = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('path') || '')
    : '';
  const [path, setPath] = useState(initialPath);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [lightboxItem, setLightboxItem] = useState<OdItem | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const segments = path ? path.split('/') : [];
  const browsePath = path ? `Images/${path}` : 'Images';

  const { data: statusData } = useQuery({
    queryKey: ['onedrive-status'],
    queryFn: () => apiClient.get<{ configured: boolean; needsAuth?: boolean }>('/onedrive/status'),
    staleTime: 60_000,
  });
  const configured = statusData?.configured ?? false;
  const needsAuth = statusData?.needsAuth ?? false;

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<{ projects: Project[] }>('/projects'),
    enabled: configured,
  });
  const projects = projectsData?.projects || [];

  const { data: browseData, isLoading, isError, refetch } = useQuery({
    queryKey: ['onedrive-browse', browsePath],
    queryFn: () => apiClient.get<{ items: OdItem[] }>(`/onedrive/browse?path=${encodeURIComponent(browsePath)}`),
    enabled: configured,
  });
  const items = browseData?.items || [];

  const fetchThumbnail = useCallback(
    async (item: OdItem) => {
      if (!isImage(item) || thumbnails[item.id]) return;
      try {
        const data = await apiClient.get<{ url: string | null }>(`/onedrive/thumbnail/${item.id}`);
        if (data.url) setThumbnails(prev => ({ ...prev, [item.id]: data.url! }));
      } catch { /* ignore */ }
    },
    [thumbnails]
  );

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

  const uploadMutation = useMutation({
    mutationFn: async ({ file, uploadPath }: { file: File; uploadPath: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', uploadPath);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch('/api/onedrive/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/onedrive/item/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      setDeletingId(null);
      setLightboxItem(null);
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
    createFolderMutation.mutate({ folderPath: path ? `Images/${path}` : 'Images', name });
  };

  const navigateFolder = (item: OdItem) => {
    if (item.type !== 'folder') return;
    setPath(prev => (prev ? `${prev}/${item.name}` : item.name));
  };

  const navigateTo = (index: number) => {
    if (index < 0) setPath('');
    else setPath(segments.slice(0, index + 1).join('/'));
  };

  const handleItemClick = (item: OdItem) => {
    if (item.type === 'folder') {
      navigateFolder(item);
    } else if (isImage(item)) {
      fetchThumbnail(item);
      setLightboxItem(item);
    }
  };

  const displayItems: OdItem[] = path === ''
    ? [
        ...projects
          .filter(p => !items.some(i => i.type === 'folder' && i.name === p.name))
          .map(p => ({ id: `proj-${p.id}`, name: p.name, type: 'folder' as const })),
        ...items,
      ].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      })
    : [...items].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });

  const imageItems = displayItems.filter(isImage);

  // ── Not configured banner ──────────────────────────────────────────────────
  if (!configured) {
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
              href="/api/onedrive/auth"
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
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Lightbox */}
      {lightboxItem && thumbnails[lightboxItem.id] && (
        <Lightbox
          item={lightboxItem}
          src={thumbnails[lightboxItem.id]}
          allImages={imageItems}
          thumbnails={thumbnails}
          onClose={() => setLightboxItem(null)}
          onNavigate={item => { fetchThumbnail(item); setLightboxItem(item); }}
          onDelete={item => { setDeletingId(item.id); deleteMutation.mutate(item.id); }}
          isDeleting={deletingId === lightboxItem.id}
        />
      )}

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
            className={cn('font-medium hover:text-indigo-600 transition-colors', path === '' ? 'text-indigo-600' : 'text-slate-600')}
          >
            Images
          </button>
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <button
                onClick={() => navigateTo(i)}
                className={cn('font-medium hover:text-indigo-600 transition-colors', i === segments.length - 1 ? 'text-indigo-600' : 'text-slate-600')}
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
            {displayItems.map(item => {
              const img = isImage(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'group relative rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200',
                    'cursor-pointer hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5',
                  )}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => img && fetchThumbnail(item)}
                >
                  {/* Thumbnail / icon area */}
                  <div className="aspect-square flex items-center justify-center bg-slate-50 relative overflow-hidden">
                    {item.type === 'folder' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Folder className="h-14 w-14 text-indigo-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    ) : thumbnails[item.id] ? (
                      <>
                        <img
                          src={thumbnails[item.id]}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={() => setThumbnails(prev => { const next = { ...prev }; delete next[item.id]; return next; })}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                        </div>
                      </>
                    ) : img ? (
                      <div className="flex items-center justify-center w-full h-full">
                        <Image className="h-12 w-12 text-slate-200" />
                      </div>
                    ) : (
                      <Image className="h-12 w-12 text-slate-200" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="px-2.5 py-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 truncate" title={item.name}>
                      {item.name}
                    </p>
                    {item.size !== undefined && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(item.size)}</p>
                    )}
                  </div>

                  {/* Delete button */}
                  {!item.id.startsWith('proj-') && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setDeletingId(item.id);
                        deleteMutation.mutate(item.id);
                      }}
                      disabled={deletingId === item.id}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 text-white"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
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
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleFileInput(e.target.files?.[0])} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" multiple
                  onChange={e => { Array.from(e.target.files || []).forEach(f => uploadMutation.mutate({ file: f, uploadPath: browsePath })); }} />

                <button onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-4 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left">
                  <Camera className="h-8 w-8 text-indigo-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800">Take a Photo</p>
                    <p className="text-xs text-slate-500">Use your camera</p>
                  </div>
                </button>

                <button onClick={() => galleryRef.current?.click()}
                  className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-4 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left">
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
    </>
  );
}

export default ImagesPage;
