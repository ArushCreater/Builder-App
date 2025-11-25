import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { Search, FileText, Download, Eye, Upload, Folder, Grid, List, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../components/ui/use-toast';

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  category: 'contract' | 'plans' | 'permit' | 'invoice' | 'photo' | 'other';
  size: string;
  projectName?: string;
  projectId?: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
  key?: string;
}

interface ProjectLite {
  id: string;
  name: string;
}

const categoryColors: Record<DocumentRow['category'], 'default' | 'secondary' | 'warning' | 'success'> = {
  contract: 'default',
  plans: 'default',
  permit: 'warning',
  invoice: 'secondary',
  photo: 'success',
  other: 'secondary',
};

type ViewMode = 'all' | 'folders';

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    projectId: '',
    projectName: '',
    folder: '',
  });
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'docs'],
    queryFn: () => apiClient.get<{ projects: ProjectLite[] }>('/projects'),
  });

  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['documents', searchTerm, categoryFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ documents: DocumentRow[] }>(`/documents?${params}`);
    },
  });
  const documents = documentsData?.documents || [];

  const uploadMutation = useMutation({
    mutationFn: (data: Partial<DocumentRow>) => apiClient.post('/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setIsUploadDialogOpen(false);
      setFormData({ name: '', category: '', projectId: '', projectName: '', folder: '' });
      setFileMeta(null);
      setSelectedFile(null);
    },
    onError: () => toast({ title: 'Upload failed', description: 'Could not save document record', variant: 'destructive' }),
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projectsData?.projects.find(p => p.id === formData.projectId);
    if (!selectedFile) {
      toast({ title: 'Select a file', description: 'Choose a file to upload', variant: 'destructive' });
      return;
    }

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const uploadResp = await apiClient.post<{ url: string; key: string; name: string; size: number; type: string }>(
        '/documents/upload',
        fd,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      const sizeLabel =
        uploadResp.size > 1024 * 1024
          ? `${(uploadResp.size / 1024 / 1024).toFixed(1)} MB`
          : `${Math.max(1, Math.round(uploadResp.size / 1024))} KB`;

      uploadMutation.mutate({
        name: formData.name || uploadResp.name,
        category: (formData.category || 'other') as DocumentRow['category'],
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || project?.name,
        type: uploadResp.type || selectedFile.type || 'file',
        size: sizeLabel,
        uploadedBy: 'You',
        url: uploadResp.url,
        key: uploadResp.key,
      });
    } catch (err) {
      toast({ title: 'Upload failed', description: 'Check file size or try again', variant: 'destructive' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const sizeKb = file.size / 1024;
    const prettySize =
      sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.max(sizeKb, 1).toFixed(0)} KB`;
    setFileMeta({ name: file.name, size: prettySize });
    setSelectedFile(file);
    if (!formData.name) {
      setFormData((prev) => ({ ...prev, name: file.name }));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDownload = (doc: DocumentRow) => {
    if (!doc.url || doc.url === '#') return;
    const link = document.createElement('a');
    link.href = doc.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.download = doc.name || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPreviewContent = () => {
    if (!previewDoc) return null;
    const url = previewDoc.url;
    const ext = (previewDoc.name.split('.').pop() || '').toLowerCase();
    const isPdf = ext === 'pdf';
    const isDoc = ext === 'doc' || ext === 'docx';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
    const canPreview = url && url !== '#';

    if (!canPreview) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <FileText className="h-12 w-12 mb-3 text-gray-400" />
          <p className="font-semibold">Preview not available</p>
          <p className="text-sm text-gray-400">No file URL provided</p>
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          title="Document preview"
          src={url}
          className="w-full h-[70vh] rounded-xl border border-gray-200"
        />
      );
    }

    if (isDoc) {
      const viewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
      return (
        <iframe
          title="Document preview"
          src={viewerUrl}
          className="w-full h-[70vh] rounded-xl border border-gray-200"
        />
      );
    }

    if (isImage) {
      return (
        <div className="w-full h-[70vh] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
          <img src={url} alt={previewDoc.name} className="max-h-[65vh] object-contain" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <FileText className="h-12 w-12 mb-3 text-gray-400" />
        <p className="font-semibold">Preview not supported</p>
        <p className="text-sm text-gray-400">Download to view this file type.</p>
      </div>
    );
  };

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projectsData?.projects.forEach(p => map.set(p.id, p.name));
    return map;
  }, [projectsData]);

  const docsByProject = useMemo(() => {
    const grouped: Record<string, DocumentRow[]> = {};
    documents.forEach(doc => {
      const key = doc.projectId || 'unassigned';
      grouped[key] = grouped[key] || [];
      grouped[key].push(doc);
    });
    return grouped;
  }, [documents]);

  const folderEntries = useMemo(() => {
    const entries =
      projectsData?.projects.map(p => ({
        id: p.id,
        name: p.name,
        count: docsByProject[p.id]?.length || 0,
      })) || [];
    if (docsByProject['unassigned']?.length) {
      entries.push({
        id: 'unassigned',
        name: 'Unassigned',
        count: docsByProject['unassigned'].length,
      });
    }
    return entries;
  }, [projectsData, docsByProject]);

  const stats = useMemo(() => {
    return {
      total: documents.length,
      contracts: documents.filter(d => d.category === 'contract').length,
      plans: documents.filter(d => d.category === 'plans').length,
      invoices: documents.filter(d => d.category === 'invoice').length,
    };
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    if (viewMode === 'folders' && selectedFolder !== 'all') {
      return documents.filter(d => (d.projectId || 'unassigned') === selectedFolder);
    }
    return documents;
  }, [documents, selectedFolder, viewMode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">Organize files by project, folders, and views.</p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleUpload}>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Drop a file and tag it to a project folder.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/80 hover:border-blue-400 transition-all duration-200 p-4 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Drag & drop files here</p>
                      <p className="text-sm text-gray-500">or click to browse from your computer</p>
                      {fileMeta && (
                        <p className="mt-1 text-sm text-gray-700">
                          Selected: {fileMeta.name} ({fileMeta.size})
                        </p>
                      )}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Document name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="plans">Plans</SelectItem>
                        <SelectItem value="permit">Permit</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="photo">Photo</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project">Project folder</Label>
                  <Select
                    value={formData.projectId || 'none'}
                    onValueChange={(val) => {
                      if (val === 'none') {
                        setFormData({ ...formData, projectId: '', projectName: '' });
                        return;
                      }
                      const proj = projectsData?.projects.find(p => p.id === val);
                      setFormData({ ...formData, projectId: val, projectName: proj?.name || '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projectsData?.projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subfolder (optional)</Label>
                  <Input
                    placeholder="e.g. contracts/2024"
                    value={formData.folder}
                    onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total docs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500">Across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.contracts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{stats.plans}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.invoices}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="contract">Contracts</SelectItem>
                  <SelectItem value="plans">Plans</SelectItem>
                  <SelectItem value="permit">Permits</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="photo">Photos</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projectsData?.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-auto">
              <TabsList>
                <TabsTrigger value="folders" className="flex items-center gap-2">
                  <Grid className="h-4 w-4" /> Folders
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <List className="h-4 w-4" /> All docs
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <Tabs value={viewMode}>
              <TabsContent value="folders" className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {folderEntries.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`border rounded-lg p-4 text-left transition hover:border-blue-500 hover:shadow-sm ${
                        selectedFolder === folder.id ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Folder className="h-5 w-5 text-blue-500" />
                          <p className="font-semibold text-gray-900">{folder.name}</p>
                        </div>
                        <Badge variant="secondary">{folder.count} files</Badge>
                      </div>
                      <p className="text-sm text-gray-500">Project folder</p>
                    </button>
                  ))}
                  {!folderEntries.length && (
                    <div className="text-gray-500 text-sm">No folders yet. Upload a document to create one.</div>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Folder</p>
                    <h3 className="text-lg font-semibold">
                      {selectedFolder === 'all'
                        ? 'All folders'
                        : folderEntries.find(f => f.id === selectedFolder)?.name || 'Select a folder'}
                    </h3>
                  </div>
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Add file
                  </Button>
                </div>
                <DocumentsTable
                  documents={visibleDocuments}
                  projectMap={projectMap}
                  onPreview={setPreviewDoc}
                  onDownload={handleDownload}
                  onDelete={(doc) => {
                    if (doc.id) {
                      apiClient.delete(`/documents/${doc.id}`).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['documents'] });
                      });
                    }
                  }}
                />
              </TabsContent>
              <TabsContent value="all">
                <DocumentsTable
                  documents={visibleDocuments}
                  projectMap={projectMap}
                  onPreview={setPreviewDoc}
                  onDownload={handleDownload}
                  onDelete={(doc) => {
                    if (doc.id) {
                      apiClient.delete(`/documents/${doc.id}`).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['documents'] });
                      });
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewDoc?.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{previewDoc?.category}</Badge>
                <Badge variant="outline">{previewDoc?.projectName || 'Unassigned'}</Badge>
              </div>
            </DialogTitle>
            <DialogDescription>Preview and download</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {renderPreviewContent()}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Uploaded by {previewDoc?.uploadedBy} on{' '}
                {previewDoc?.uploadedAt ? new Date(previewDoc.uploadedAt).toLocaleString() : '—'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownload(previewDoc!)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setPreviewDoc(null)}>Close</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTable({
  documents,
  projectMap,
  onPreview,
  onDownload,
  onDelete,
}: {
  documents: DocumentRow[];
  projectMap: Map<string, string>;
  onPreview: (doc: DocumentRow) => void;
  onDownload: (doc: DocumentRow) => void;
  onDelete: (doc: DocumentRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Uploaded By</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents?.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                {doc.name}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={categoryColors[doc.category]}>
                {doc.category}
              </Badge>
            </TableCell>
            <TableCell>{doc.type}</TableCell>
            <TableCell>{doc.size}</TableCell>
            <TableCell>{doc.projectName || projectMap.get(doc.projectId || '') || '-'}</TableCell>
            <TableCell>{doc.uploadedBy}</TableCell>
            <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => onPreview(doc)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDownload(doc)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(doc)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {!documents.length && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-gray-500">
              No documents found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default DocumentsPage;
