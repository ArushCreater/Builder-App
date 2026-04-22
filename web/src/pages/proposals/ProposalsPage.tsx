import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, FileText, Download, Filter, ChevronDown, Trash2, Edit, Eye, Image as ImageIcon } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Proposal {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
  validUntil: string;
  createdAt: string;
  projectName?: string;
  projectId?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

const statusColors = {
  draft: 'secondary',
  sent: 'default',
  viewed: 'default',
  accepted: 'success',
  rejected: 'destructive',
} as const;

export function ProposalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    clientName: '',
    amount: '',
    validUntil: '',
    projectId: '',
    projectName: '',
    status: 'draft',
  });
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => apiClient.get<{ projects: ProjectOption[] }>('/projects'),
  });

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ proposals: Proposal[] }>(`/proposals?${params}`);
    },
  });
  const proposalRows = useMemo(
    () =>
      (proposals?.proposals || []).map((p: any) => ({
        ...p,
        projectId: p.projectId || p.project_id || '',
        projectName: p.projectName || p.project_name || '',
        clientName: p.clientName || p.client_name || '',
        validUntil: p.validUntil || p.valid_until || '',
        amount: Number(p.amount ?? 0),
        fileUrl: p.fileUrl || p.file_url,
        fileName: p.fileName || p.file_name,
        fileType: p.fileType || p.file_type,
      })),
    [proposals?.proposals]
  );
  const projectOptions = projectsData?.projects || [];

  const totals = useMemo(() => {
    const total = proposalRows.length;
    const sent = proposalRows.filter(p => ['sent', 'viewed'].includes(p.status)).length;
    const accepted = proposalRows.filter(p => p.status === 'accepted').length;
    const value = proposalRows.reduce((sum, p) => sum + (p.amount || 0), 0);
    return { total, sent, accepted, value };
  }, [proposalRows]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Proposal>) =>
      editingId ? apiClient.put(`/proposals/${editingId}`, data) : apiClient.post('/proposals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setIsCreateDialogOpen(false);
      setEditingId(null);
      setFormData({
        id: '',
        title: '',
        clientName: '',
        amount: '',
        validUntil: '',
        projectId: '',
        projectName: '',
        status: 'draft',
      });
      setUploadedFile(null);
      toast({
        title: 'Saved',
        description: 'Proposal saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save proposal',
        variant: 'destructive',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: Proposal['status'] }) =>
      apiClient.patch(`/proposals/${payload.id}`, { status: payload.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/proposals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
    onError: () =>
      toast({ title: 'Error', description: 'Could not delete proposal', variant: 'destructive' }),
  });

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title: formData.title,
      clientName: formData.clientName,
      amount: parseFloat(formData.amount) || 0,
      validUntil: formData.validUntil || undefined,
      projectId: formData.projectId || undefined,
      projectName:
        formData.projectId && projectOptions.find(p => p.id === formData.projectId)?.name
          ? projectOptions.find(p => p.id === formData.projectId)?.name
          : formData.projectName,
      status: formData.status as Proposal['status'],
      fileUrl: uploadedFile?.url,
      fileName: uploadedFile?.name,
      fileType: uploadedFile?.type,
    });
  };

  const handleEdit = (proposal: Proposal) => {
    setEditingId(proposal.id);
    setFormData({
      id: proposal.id,
      title: proposal.title,
      clientName: proposal.clientName,
      amount: proposal.amount.toString(),
      validUntil: proposal.validUntil,
      projectId: proposal.projectId || '',
      projectName: proposal.projectName || '',
      status: proposal.status,
    });
    setUploadedFile(
      proposal.fileUrl
        ? { url: proposal.fileUrl, name: proposal.fileName || '', type: proposal.fileType || '' }
        : null
    );
    setIsCreateDialogOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File must be under 10MB', variant: 'destructive' });
      return;
    }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Error', description: 'Only PDF, JPG, PNG allowed', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedFile({
        url: event.target?.result as string,
        name: file.name,
        type: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (proposal: Proposal) => {
    if (!proposal.fileUrl || !proposal.fileName) return;
    const link = document.createElement('a');
    link.href = proposal.fileUrl;
    link.download = proposal.fileName;
    link.click();
  };

  const groupedByStatus = ['draft', 'sent', 'accepted', 'rejected'].map(status => ({
    key: status as Proposal['status'],
    items: proposalRows.filter(p => p.status === status),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">Proposals</h1>
          <p className="text-gray-500 text-sm leading-snug">Quote, send, and track proposals across projects.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Edit Proposal' : 'New Proposal'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full">
            <form onSubmit={handleCreateProposal}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Proposal' : 'Create New Proposal'}</DialogTitle>
                <DialogDescription>Attach to a project, set amount and validity.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project">Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = projectOptions.find(p => p.id === value);
                        setFormData({
                          ...formData,
                          projectId: value,
                          projectName: proj?.name || '',
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projectOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Valid Until</Label>
                    <Input
                      id="validUntil"
                      name="validUntil"
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Attach File (PDF/Image)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={handleFileUpload}
                    />
                    {uploadedFile && (
                      <Badge variant="secondary" className="max-w-[200px] truncate">
                        {uploadedFile.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Up to 10MB. PDFs and images only.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Proposal['status']) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="viewed">Viewed</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setEditingId(null); }} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                  {createMutation.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Create Proposal'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Proposals</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Sent/Viewed</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.sent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Accepted</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-700">{totals.accepted}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.value)}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search proposals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {groupedByStatus.map((group) => (
                  <div key={group.key} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold text-gray-800 capitalize">{group.key}</span>
                      </div>
                      <Badge variant="outline">{group.items.length}</Badge>
                    </div>
                    <div className="p-3 space-y-3 min-h-[220px]">
                      {group.items.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-8">No proposals</div>
                      ) : (
                        group.items.map((proposal) => (
                          <div key={proposal.id} className="rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-gray-900">{proposal.title}</div>
                                <div className="text-xs text-gray-500">{proposal.clientName}</div>
                              </div>
                              <Badge variant={statusColors[proposal.status as Proposal['status']]}>{proposal.status}</Badge>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
                              <span>{proposal.projectName || 'No project'}</span>
                              <span className="font-semibold">{formatCurrency(proposal.amount)}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                              <ChevronDown className="h-3 w-3 rotate-180" />
                              Valid until {proposal.validUntil ? formatDate(proposal.validUntil) : 'N/A'}
                            </div>
                            {proposal.fileName && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                                <FileText className="h-3 w-3" />
                                <span className="truncate">{proposal.fileName}</span>
                              </div>
                            )}
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <Select
                                value={proposal.status}
                                onValueChange={(s) => statusMutation.mutate({ id: proposal.id, status: s as Proposal['status'] })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="sent">Sent</SelectItem>
                                  <SelectItem value="viewed">Viewed</SelectItem>
                                  <SelectItem value="accepted">Accepted</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1">
                                {proposal.fileUrl && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setPreviewFile({
                                          url: proposal.fileUrl!,
                                          name: proposal.fileName || '',
                                          type: proposal.fileType || '',
                                        });
                                        setIsPreviewOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDownload(proposal)}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(proposal)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <ConfirmDialog
                                  title="Delete proposal?"
                                  description="This permanently removes the proposal. This cannot be undone."
                                  confirmText="Delete"
                                  confirmVariant="destructive"
                                  confirmDisabled={deleteMutation.isPending}
                                  onConfirm={() => deleteMutation.mutate(proposal.id)}
                                  trigger={
                                    <Button size="icon" variant="ghost">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>All Proposals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Valid Until</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proposalRows.map((proposal) => (
                          <TableRow key={proposal.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-2 text-gray-400" />
                                {proposal.title}
                              </div>
                            </TableCell>
                            <TableCell>{proposal.clientName}</TableCell>
                            <TableCell>{proposal.projectName || '-'}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(proposal.amount)}</TableCell>
                            <TableCell>
                              <Badge variant={statusColors[proposal.status as Proposal['status']]}>
                                {proposal.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {proposal.fileName ? (
                                <div className="flex items-center gap-1 text-sm text-blue-600">
                                  {proposal.fileType?.includes('pdf') ? (
                                    <FileText className="h-4 w-4" />
                                  ) : (
                                    <ImageIcon className="h-4 w-4" />
                                  )}
                                  <span className="truncate max-w-[110px]">{proposal.fileName}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">No file</span>
                              )}
                            </TableCell>
                            <TableCell>{proposal.validUntil ? formatDate(proposal.validUntil) : '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {proposal.fileUrl && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setPreviewFile({
                                          url: proposal.fileUrl!,
                                          name: proposal.fileName || '',
                                          type: proposal.fileType || '',
                                        });
                                        setIsPreviewOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDownload(proposal)}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(proposal)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <ConfirmDialog
                                  title="Delete proposal?"
                                  description="This permanently removes the proposal. This cannot be undone."
                                  confirmText="Delete"
                                  confirmVariant="destructive"
                                  confirmDisabled={deleteMutation.isPending}
                                  onConfirm={() => deleteMutation.mutate(proposal.id)}
                                  trigger={
                                    <Button size="icon" variant="ghost">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Proposal Attachment</DialogTitle>
          </DialogHeader>
          {previewFile ? (
            previewFile.type?.includes('pdf') ? (
              <iframe src={previewFile.url} title="Proposal file" className="w-full h-[70vh] rounded-md border" />
            ) : (
              <img src={previewFile.url} alt="Proposal file" className="w-full h-auto rounded-md border" />
            )
          ) : (
            <div className="text-sm text-gray-500">No file to preview.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProposalsPage;


