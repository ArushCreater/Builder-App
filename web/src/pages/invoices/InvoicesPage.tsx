import { useState, useEffect } from 'react';
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

interface Invoice {
  id: string;
  invoiceNumber: string;
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
}

const statusColors = {
  paid: 'default',
  unpaid: 'secondary',
  overdue: 'destructive',
  draft: 'outline',
} as const;

export function InvoicesPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    projectName: '',
    clientName: '',
    amount: '',
    status: 'draft' as Invoice['status'],
    dueDate: '',
    issueDate: '',
    description: '',
  });
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);

  // Load invoices from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('demo_invoices');
    if (stored) {
      setInvoices(JSON.parse(stored));
    } else {
      // Add some demo data
      const demoInvoices: Invoice[] = [
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          projectName: 'Sunrise Apartments',
          clientName: 'John Smith',
          amount: 45000,
          status: 'paid',
          dueDate: '2024-01-15',
          issueDate: '2024-01-01',
          description: 'Foundation and framing work',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          projectName: 'Downtown Office',
          clientName: 'ABC Corporation',
          amount: 78500,
          status: 'unpaid',
          dueDate: '2024-02-28',
          issueDate: '2024-02-01',
          description: 'Electrical and plumbing installation',
          createdAt: '2024-02-01T10:00:00Z',
        },
        {
          id: '3',
          invoiceNumber: 'INV-2024-003',
          projectName: 'Lake House',
          clientName: 'Jane Doe',
          amount: 32000,
          status: 'overdue',
          dueDate: '2024-01-20',
          issueDate: '2024-01-05',
          description: 'Roofing and exterior finish',
          createdAt: '2024-01-05T10:00:00Z',
        },
      ];
      setInvoices(demoInvoices);
      localStorage.setItem('demo_invoices', JSON.stringify(demoInvoices));
    }
  }, []);

  // Save to localStorage whenever invoices change
  useEffect(() => {
    if (invoices.length > 0) {
      localStorage.setItem('demo_invoices', JSON.stringify(invoices));
    }
  }, [invoices]);

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

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    const newInvoice: Invoice = {
      id: Date.now().toString(),
      invoiceNumber: formData.invoiceNumber || `INV-${Date.now()}`,
      projectName: formData.projectName,
      clientName: formData.clientName,
      amount: parseFloat(formData.amount),
      status: formData.status,
      dueDate: formData.dueDate,
      issueDate: formData.issueDate,
      description: formData.description,
      fileUrl: uploadedFile?.url,
      fileName: uploadedFile?.name,
      fileType: uploadedFile?.type,
      createdAt: new Date().toISOString(),
    };

    setInvoices([newInvoice, ...invoices]);
    setIsCreateDialogOpen(false);
    setFormData({
      invoiceNumber: '',
      projectName: '',
      clientName: '',
      amount: '',
      status: 'draft',
      dueDate: '',
      issueDate: '',
      description: '',
    });
    setUploadedFile(null);

    toast({
      title: 'Success',
      description: 'Invoice created successfully',
    });
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(invoices.filter((inv) => inv.id !== id));
    toast({
      title: 'Success',
      description: 'Invoice deleted successfully',
    });
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

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

  const handleUpdateStatus = (id: string, newStatus: Invoice['status']) => {
    setInvoices(
      invoices.map((inv) =>
        inv.id === id ? { ...inv, status: newStatus } : inv
      )
    );
    toast({
      title: 'Success',
      description: 'Invoice status updated',
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidAmount = filteredInvoices
    .filter((inv) => inv.status === 'unpaid' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage and track all project invoices</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateInvoice}>
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>Add a new invoice with optional file attachment</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      name="projectName"
                      value={formData.projectName}
                      onChange={handleChange}
                      required
                    />
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
                <div className="grid grid-cols-2 gap-4">
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
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Invoice (Image/PDF)</Label>
                  <div className="flex items-center gap-2">
                    <Input
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
                <Button type="submit">Create Invoice</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
          </div>
        </CardHeader>
        <CardContent>
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
                          handleUpdateStatus(invoice.id, value as Invoice['status'])
                        }
                      >
                        <SelectTrigger className="w-[110px]">
                          <Badge variant={statusColors[invoice.status]}>
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
                    <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Invoice Number</Label>
                  <p className="font-semibold">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <Badge variant={statusColors[selectedInvoice.status]} className="mt-1">
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Project</Label>
                  <p className="font-semibold">{selectedInvoice.projectName}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Client</Label>
                  <p className="font-semibold">{selectedInvoice.clientName}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-500">Amount</Label>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Issue Date</Label>
                  <p className="font-semibold">
                    {formatDate(selectedInvoice.issueDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Due Date</Label>
                  <p className="font-semibold">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-500">Description</Label>
                <p className="mt-1">{selectedInvoice.description}</p>
              </div>
              {selectedInvoice.fileUrl && (
                <div>
                  <Label className="text-gray-500 mb-2 block">Attached File</Label>
                  {selectedInvoice.fileType?.includes('pdf') ? (
                    <div className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
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
