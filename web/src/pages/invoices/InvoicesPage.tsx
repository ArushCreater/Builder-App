import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  Plus,
  Search,
  Upload,
  FileText,
  Download,
  Trash2,
  Eye,
  DollarSign,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { apiClient } from '../../lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId?: string;
  projectName: string;
  clientName: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue' | 'draft';
  dueDate: string;
  issueDate: string;
  description: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
  type?: string;
}

const statusColors = {
  paid: 'default',
  unpaid: 'secondary',
  overdue: 'destructive',
  draft: 'outline',
} as const;

export function InvoicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    projectId: '',
    projectName: '',
    clientName: '',
    amount: '',
    status: 'draft' as Invoice['status'],
    dueDate: '',
    issueDate: '',
    description: '',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'invoice'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      params.append('type', 'invoice');
      return apiClient.get<{ invoices: Invoice[] }>(`/invoices?${params}`);
    },
  });
  const invoices = useMemo(() => {
    return (invoicesData?.invoices || []).map((inv: any) => ({
      ...inv,
      invoiceNumber: inv.invoiceNumber || inv.invoice_number || '',
      projectName: inv.projectName || inv.project_name || '',
      projectId: inv.projectId || inv.project_id || '',
      clientName: inv.clientName || inv.client_name || '',
      issueDate: inv.issueDate || inv.issue_date || '',
      dueDate: inv.dueDate || inv.due_date || '',
      description: inv.description || inv.description_text || '',
      amount: Number(inv.amount ?? 0),
    }));
  }, [invoicesData?.invoices]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'File size must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Only JPG, PNG, and PDF files are allowed',
        variant: 'destructive',
      });
      return;
    }

    // Read file as base64 for demo mode
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedFile({
        url: event.target?.result as string,
        name: file.name,
        type: file.type,
      });
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
    };
    reader.readAsDataURL(file);
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<Invoice>) => apiClient.post('/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsCreateDialogOpen(false);
      setFormData({
        invoiceNumber: '',
        projectId: '',
        projectName: '',
        clientName: '',
        amount: '',
        status: 'draft',
        dueDate: '',
        issueDate: '',
        description: '',
      });
      setUploadedFile(null);
      toast({ title: 'Success', description: 'Invoice created successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create invoice', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Success', description: 'Invoice deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete invoice', variant: 'destructive' }),
  });

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Invoice>) => {
      if (!editingInvoice) throw new Error('No invoice selected');
      return apiClient.put(`/invoices/${editingInvoice.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsEditDialogOpen(false);
      setEditingInvoice(null);
      setUploadedFile(null);
      toast({ title: 'Success', description: 'Invoice updated successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update invoice', variant: 'destructive' }),
  });

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.fileUrl && invoice.fileName) {
      const link = document.createElement('a');
      link.href = invoice.fileUrl;
      link.download = invoice.fileName;
      link.click();
      toast({
        title: 'Success',
        description: 'Invoice downloaded successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: 'No file attached to this invoice',
        variant: 'destructive',
      });
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice['status'] }) =>
      apiClient.patch(`/invoices/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProject = formData.projectId
      ? ((projectsData?.projects.find((p) => p.id === formData.projectId) as { id: string; name: string }) ||
          undefined)
      : undefined;
    const invoiceNumber = formData.invoiceNumber || `INV-${Date.now()}`;
    createMutation.mutate({
      invoiceNumber,
      projectId: formData.projectId || undefined,
      projectName: formData.projectName || selectedProject?.name || '',
      clientName: formData.clientName,
      amount: parseFloat(formData.amount) || 0,
      status: formData.status,
      dueDate: formData.dueDate || undefined,
      issueDate: formData.issueDate || undefined,
      description: formData.description,
      type: 'invoice',
      fileUrl: uploadedFile?.url,
      fileName: uploadedFile?.name,
      fileType: uploadedFile?.type,
    });
  };

  const handleUpdateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    const selectedProject = formData.projectId
      ? ((projectsData?.projects.find((p) => p.id === formData.projectId) as { id: string; name: string }) ||
          undefined)
      : undefined;
    const invoiceNumber = formData.invoiceNumber || editingInvoice.invoiceNumber || `INV-${Date.now()}`;
    updateMutation.mutate({
      invoiceNumber,
      projectId: formData.projectId || undefined,
      projectName: formData.projectName || selectedProject?.name || editingInvoice.projectName,
      clientName: formData.clientName,
      amount: parseFloat(formData.amount) || 0,
      status: formData.status,
      dueDate: formData.dueDate || undefined,
      issueDate: formData.issueDate || undefined,
      description: formData.description,
      type: 'invoice',
      fileUrl: uploadedFile?.url,
      fileName: uploadedFile?.name,
      fileType: uploadedFile?.type,
    });
  };

  const filteredInvoices = useMemo(() => {
    return invoices;
  }, [invoices]);

  const projectSummaries = useMemo(() => {
    const grouped: Record<string, { id: string; name: string; count: number; total: number }> = {};
    invoices.forEach(inv => {
      const key = inv.projectId || inv.projectName || 'none';
      if (!grouped[key]) {
        grouped[key] = { id: inv.projectId || '', name: inv.projectName || 'No project', count: 0, total: 0 };
      }
      grouped[key].count += 1;
      grouped[key].total += inv.amount || 0;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidAmount = filteredInvoices
    .filter((inv) => inv.status === 'unpaid' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage and track all project invoices</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <form onSubmit={handleCreateInvoice}>
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>Add a new invoice with optional file attachment</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      name="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={handleChange}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value as Invoice['status'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = projectsData?.projects.find(p => p.id === value);
                        setFormData({ ...formData, projectId: value, projectName: proj?.name || '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
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
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date</Label>
                    <Input
                      id="issueDate"
                      name="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Upload Invoice (Image/PDF)</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        ref={fileInputRef}
                        id="file"
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={handleFileUpload}
                        className="cursor-pointer"
                      />
                      <Upload className="h-5 w-5 text-gray-400" />
                    </div>
                    {uploadedFile && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <FileText className="h-4 w-4" />
                        {uploadedFile.name}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Accepted formats: JPG, PNG, PDF (max 10MB)
                    </p>
                  </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setUploadedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Create Invoice'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Edit Invoice Dialog */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setEditingInvoice(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <form onSubmit={handleUpdateInvoice}>
              <DialogHeader>
                <DialogTitle>Edit Invoice</DialogTitle>
                <DialogDescription>Update an existing invoice and its attachment.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber-edit">Invoice Number</Label>
                    <Input
                      id="invoiceNumber-edit"
                      name="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={handleChange}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-edit">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value as Invoice['status'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="projectName-edit">Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = projectsData?.projects.find(p => p.id === value);
                        setFormData({ ...formData, projectId: value, projectName: proj?.name || '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
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
                    <Label htmlFor="clientName-edit">Client Name</Label>
                    <Input
                      id="clientName-edit"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount-edit">Amount ($)</Label>
                  <Input
                    id="amount-edit"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate-edit">Issue Date</Label>
                    <Input
                      id="issueDate-edit"
                      name="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate-edit">Due Date</Label>
                    <Input
                      id="dueDate-edit"
                      name="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description-edit">Description</Label>
                  <Input
                    id="description-edit"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="text-gray-900"
                  />
                </div>
                  <div className="space-y-2">
                    <Label>Attachment</Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      {uploadedFile && (
                        <Badge variant="secondary" className="truncate max-w-[180px]">
                          {uploadedFile.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Update Invoice'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredInvoices.length} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(paidAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredInvoices.filter((inv) => inv.status === 'paid').length} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(unpaidAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredInvoices.filter(
                (inv) => inv.status === 'unpaid' || inv.status === 'overdue'
              ).length}{' '}
              invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project quick filter cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projectSummaries.map((proj) => (
          <Card
            key={proj.id || proj.name}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setProjectFilter(proj.id || 'all')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {proj.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(proj.total)}</div>
                <p className="text-xs text-gray-500">{proj.count} invoice(s)</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setProjectFilter('all');
                }}
              >
                Clear
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projectsData?.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {filteredInvoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No invoices found
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{invoice.invoiceNumber}</div>
                      <div className="mt-1 text-sm text-slate-600">{invoice.projectName || 'No project'}</div>
                      <div className="text-sm text-slate-500">{invoice.clientName}</div>
                    </div>
                    <Badge variant={statusColors[invoice.status as Invoice['status']]}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Amount</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(invoice.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Issue</span>
                      <span>{invoice.issueDate ? formatDate(invoice.issueDate) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Due</span>
                      <span>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Select
                      value={invoice.status}
                      onValueChange={(value) =>
                        statusMutation.mutate({ id: invoice.id, status: value as Invoice['status'] })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingInvoice(invoice);
                        setFormData({
                          invoiceNumber: invoice.invoiceNumber,
                          projectId: invoice.projectId || '',
                          projectName: invoice.projectName,
                          clientName: invoice.clientName,
                          amount: invoice.amount.toString(),
                          status: invoice.status,
                          dueDate: invoice.dueDate,
                          issueDate: invoice.issueDate,
                          description: invoice.description,
                        });
                        setUploadedFile(
                          invoice.fileUrl
                            ? { url: invoice.fileUrl, name: invoice.fileName || '', type: invoice.fileType || '' }
                            : null
                        );
                        setIsEditDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {invoice.fileUrl && (
                      <Button variant="outline" size="icon" onClick={() => handleDownloadInvoice(invoice)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <ConfirmDialog
                      title="Delete invoice?"
                      description="This permanently removes the invoice. This cannot be undone."
                      confirmText="Delete"
                      confirmVariant="destructive"
                      confirmDisabled={deleteMutation.isPending}
                      onConfirm={() => deleteMutation.mutate(invoice.id)}
                      trigger={
                        <Button variant="outline" size="icon">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{invoice.projectName}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(invoice.amount)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) =>
                          statusMutation.mutate({ id: invoice.id, status: value as Invoice['status'] })
                        }
                      >
                        <SelectTrigger className="w-[110px]">
                          <Badge variant={statusColors[invoice.status as Invoice['status']]}>
                            {invoice.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{invoice.issueDate ? formatDate(invoice.issueDate) : '—'}</TableCell>
                    <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</TableCell>
                    <TableCell>
                      {invoice.fileName ? (
                        <div className="flex items-center gap-1 text-sm text-blue-600">
                          {invoice.fileType?.includes('pdf') ? (
                            <FileText className="h-4 w-4" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                          <span className="truncate max-w-[80px]">
                            {invoice.fileName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No file</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setFormData({
                              invoiceNumber: invoice.invoiceNumber,
                              projectId: invoice.projectId || '',
                              projectName: invoice.projectName,
                              clientName: invoice.clientName,
                              amount: invoice.amount.toString(),
                              status: invoice.status,
                              dueDate: invoice.dueDate,
                              issueDate: invoice.issueDate,
                              description: invoice.description,
                            });
                            setUploadedFile(
                              invoice.fileUrl
                                ? { url: invoice.fileUrl, name: invoice.fileName || '', type: invoice.fileType || '' }
                                : null
                            );
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.fileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <ConfirmDialog
                          title="Delete invoice?"
                          description="This permanently removes the invoice. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(invoice.id)}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-5 text-gray-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Invoice Number</Label>
                  <p className="font-semibold">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <Badge variant={statusColors[selectedInvoice.status as Invoice['status']]} className="mt-1">
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Project</Label>
                  <p className="font-semibold">{selectedInvoice.projectName || '—'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Client</Label>
                  <p className="font-semibold">{selectedInvoice.clientName || '—'}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-500">Amount</Label>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Issue Date</Label>
                  <p className="font-semibold">
                    {selectedInvoice.issueDate ? formatDate(selectedInvoice.issueDate) : '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Due Date</Label>
                  <p className="font-semibold">
                    {selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : '—'}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-gray-500">Description</Label>
                <p className="mt-1 leading-relaxed">{selectedInvoice.description || '—'}</p>
              </div>
              {selectedInvoice.fileUrl && (
                <div>
                  <Label className="text-gray-500 mb-2 block">Attached File</Label>
                  {selectedInvoice.fileType?.includes('pdf') ? (
                    <div className="border rounded-lg p-4 flex items-center justify-between bg-gray-50">
                      <div className="flex items-center gap-2 text-gray-900">
                        <FileText className="h-8 w-8 text-red-600" />
                        <span className="font-medium">{selectedInvoice.fileName}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDownloadInvoice(selectedInvoice)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ) : (
                    <img
                      src={selectedInvoice.fileUrl}
                      alt="Invoice"
                      className="w-full h-auto rounded-lg border"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvoicesPage;
