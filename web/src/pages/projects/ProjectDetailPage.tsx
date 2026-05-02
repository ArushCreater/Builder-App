import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  Edit,
  Plus,
  Trash2,
  Clock,
  MapPin,
  LayoutPanelTop,
  BookOpen,
  Package,
  ClipboardCheck,
} from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { useToast } from '../../components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { RichDocEditor } from '../../components/RichDocEditor';

interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget: number;
  actualCost: number;
  progress?: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BudgetItem {
  id: string;
  projectId: string;
  category: string;
  description?: string;
  budgetedAmount: number;
  actualAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  projectId: string;
  name: string;
  type: string;
  category: string;
  fileKey?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  assignee?: string;
  location?: string;
}

interface DocPage {
  id: string;
  title: string;
  content: string;
  images: string[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectName: string;
  clientName: string;
  amount: number;
  status: string;
  dueDate?: string;
  issueDate?: string;
  description?: string;
}

interface Material {
  id: string;
  projectId?: string;
  totalCost?: number;
}

interface Expense {
  id: string;
  projectId?: string;
  amount?: number;
  tax?: number;
  total?: number;
  type?: string;
}

interface Selection {
  id: string;
  projectId?: string;
  category?: string;
  item?: string;
  choice?: string;
  status?: string;
  cost?: number;
  clientName?: string;
  dueDate?: string;
  createdAt?: string;
}

interface Inspection {
  id: string;
  projectId?: string;
  title?: string;
  type?: string;
  status?: string;
  scheduledDate?: string;
  inspector?: string;
  notes?: string;
  createdAt?: string;
}

interface DailyLog {
  id: string;
  projectId?: string;
  projectName?: string;
  date?: string;
  weather?: string;
  temperature?: string;
  workPerformed?: string;
  crewSize?: number;
  hoursWorked?: number;
  notes?: string;
  createdBy?: string;
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignedTo: '',
    dueDate: '',
  });
  const [docForm, setDocForm] = useState({
    name: '',
    type: 'file',
    category: 'other',
    fileSize: '',
    mimeType: '',
    url: '',
    key: '',
  });
const [invoiceForm, setInvoiceForm] = useState({
  invoiceNumber: '',
  clientName: '',
  amount: '',
  status: 'draft',
  dueDate: '',
  issueDate: '',
  description: '',
});
const [depositDialogOpen, setDepositDialogOpen] = useState(false);
const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const docFileRef = useRef<HTMLInputElement | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    type: '',
    status: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    startDate: '',
    endDate: '',
    estimatedBudget: '',
    actualCost: '',
  });
  const [progressValue, setProgressValue] = useState(0);

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.get<{ project: Project }>(`/projects/${id}`),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => apiClient.get<{ tasks: Task[] }>(`/projects/${id}/tasks`),
  });

  const { data: budgetData } = useQuery({
    queryKey: ['project-budget', id],
    queryFn: () => apiClient.get<{ items: BudgetItem[]; summary: any }>(`/projects/${id}/budget`),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['project-invoices', id],
    queryFn: () => apiClient.get<{ invoices: Invoice[] }>(`/invoices?projectId=${id}&type=deposit`),
  });

  const { data: projectInvoicesData } = useQuery({
    queryKey: ['project-invoices-full', id],
    queryFn: () => apiClient.get<{ invoices: Invoice[] }>(`/invoices?projectId=${id}&type=invoice`),
  });

  const { data: materialsData } = useQuery({
    queryKey: ['project-materials', id],
    queryFn: () => apiClient.get<{ materials: Material[] }>(`/materials?projectId=${id}`),
  });

  const { data: projectExpensesData } = useQuery({
    queryKey: ['project-expenses', id],
    queryFn: () => apiClient.get<{ expenses: Expense[] }>(`/expenses?type=project&projectId=${id}`),
  });

  const { data: selectionsData } = useQuery({
    queryKey: ['project-selections', id],
    queryFn: () => apiClient.get<{ selections: Selection[] }>(`/selections?projectId=${id}`),
  });

  const { data: inspectionsData } = useQuery({
    queryKey: ['project-inspections', id],
    queryFn: () => apiClient.get<{ inspections: Inspection[] }>(`/inspections?projectId=${id}`),
  });

  const { data: dailyLogsData } = useQuery({
    queryKey: ['project-daily-logs', id],
    queryFn: () => apiClient.get<{ logs: DailyLog[] }>(`/daily-logs?projectId=${id}`),
  });

  const { data: documentsData } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: () => apiClient.get<{ documents: Document[] }>(`/projects/${id}/documents`),
  });

  const { data: scheduleData } = useQuery({
    queryKey: ['project-schedule', id],
    queryFn: () => apiClient.get<{ events: ScheduleEvent[] }>(`/schedule/events?projectId=${id}`),
  });

  const project = projectData?.project;
  const tasks = tasksData?.tasks || [];
  const budgetItems = budgetData?.items || [];
  const invoices = useMemo(
    () =>
      (invoicesData?.invoices || []).map((inv: any) => ({
        ...inv,
        issueDate: inv.issueDate || inv.issue_date || '',
        dueDate: inv.dueDate || inv.due_date || '',
        clientName: inv.clientName || inv.client_name || '',
        description: inv.description || inv.description_text || inv.description || '',
      })),
    [invoicesData?.invoices]
  );
  const projectInvoices = useMemo(
    () =>
      (projectInvoicesData?.invoices || []).map((inv: any) => ({
        ...inv,
        issueDate: inv.issueDate || inv.issue_date || '',
        dueDate: inv.dueDate || inv.due_date || '',
        clientName: inv.clientName || inv.client_name || '',
        description: inv.description || inv.description_text || inv.description || '',
      })),
    [projectInvoicesData?.invoices]
  );
  const materials = (materialsData?.materials || []).map((m: any) => ({
    ...m,
    name: m.name || 'Material',
    totalCost: Number(m.totalCost ?? m.total_cost ?? 0) || (Number(m.quantity ?? 0) * Number(m.costPerUnit ?? m.cost_per_unit ?? 0)),
    quantity: Number(m.quantity ?? 0),
    costPerUnit: Number(m.costPerUnit ?? m.cost_per_unit ?? 0),
  }));
  const projectExpenses = projectExpensesData?.expenses || [];
  const selections = selectionsData?.selections || [];
  const inspections = inspectionsData?.inspections || [];
  const dailyLogs = dailyLogsData?.logs || [];
  const documents = documentsData?.documents || [];
  const scheduleEvents = scheduleData?.events || [];

  const depositTotals = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const paid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return { total, paid };
  }, [invoices]);

  const expenseTotals = useMemo(() => {
    const materialCost = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
    const expenseCost = projectExpenses.reduce((sum, e) => {
      const value = e.total ?? ((e.amount || 0) + (e.tax || 0));
      return sum + value;
    }, 0);
    const total = materialCost + expenseCost;
    return { materialCost, expenseCost, total };
  }, [materials, projectExpenses]);

  const budgetBaseline = useMemo(() => {
    return Math.max(project?.estimatedBudget || 0, depositTotals.total, expenseTotals.total, 1);
  }, [project?.estimatedBudget, depositTotals.total, expenseTotals.total]);
  const combinedPlanItems = useMemo(() => {
    const events = scheduleEvents.map(ev => ({
      id: ev.id,
      title: ev.title,
      startDate: ev.startDate,
      endDate: ev.endDate || ev.startDate,
      type: ev.type || 'event',
    }));
    const taskEvents = tasks
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startDate: t.dueDate!,
        endDate: t.dueDate!,
        type: 'task',
      }));
    return [...events, ...taskEvents].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [scheduleEvents, tasks]);

  const { data: docPagesData } = useQuery({
    queryKey: ['project-doc-pages', id],
    queryFn: () => apiClient.get<{ pages: DocPage[] }>(`/projects/${id}/doc-pages`),
    enabled: !!id,
  });
  const docPages = useMemo<DocPage[]>(() => docPagesData?.pages || [], [docPagesData]);

  const createPageMutation = useMutation({
    mutationFn: (data: Partial<DocPage>) =>
      apiClient.post<{ page: DocPage }>(`/projects/${id}/doc-pages`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project-doc-pages', id] });
      setSelectedPageId(res.page.id);
    },
    onError: () => toast({ title: 'Error', description: 'Could not create page', variant: 'destructive' }),
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ pageId, ...data }: { pageId: string } & Partial<DocPage>) =>
      apiClient.put<{ page: DocPage }>(`/projects/${id}/doc-pages/${pageId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-doc-pages', id] }),
    onError: () => toast({ title: 'Error', description: 'Could not save page', variant: 'destructive' }),
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiClient.delete<{ page: DocPage }>(`/projects/${id}/doc-pages/${pageId}`),
    onSuccess: (_res, pageId) => {
      queryClient.invalidateQueries({ queryKey: ['project-doc-pages', id] });
      if (selectedPageId === pageId) setSelectedPageId(null);
      toast({ title: 'Page deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not delete page', variant: 'destructive' }),
  });

  const filteredDocPages = useMemo(() => {
    if (!docSearch) return docPages;
    const q = docSearch.toLowerCase();
    return docPages.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
  }, [docPages, docSearch]);

  useEffect(() => {
    if (selectedPageId && docPages.some((p) => p.id === selectedPageId)) return;
    if (docPages.length > 0) setSelectedPageId(docPages[0].id);
    else setSelectedPageId(null);
  }, [docPages, selectedPageId]);

  useEffect(() => {
    const page = docPages.find((p) => p.id === selectedPageId);
    setDraftTitle(page?.title || '');
  }, [selectedPageId, docPages]);

  const selectedPage = docPages.find(p => p.id === selectedPageId) || null;
  useEffect(() => {
    if (project?.progress !== undefined && project.progress !== null) {
      setProgressValue(Math.round(project.progress));
    }
  }, [project?.progress]);

  const taskMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<{ task: Task }>(`/projects/${id}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsTaskDialogOpen(false);
      setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', assignedTo: '', dueDate: '' });
      toast({ title: 'Task added' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not add task', variant: 'destructive' }),
  });

  const taskUpdateMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient.put<{ task: Task }>(`/projects/${id}/tasks/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update task', variant: 'destructive' }),
  });

  const docMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<{ document: Document }>(`/projects/${id}/documents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', id] });
      setIsDocDialogOpen(false);
      setDocForm({ name: '', type: 'file', category: 'other', fileSize: '', mimeType: '', url: '', key: '' });
      toast({ title: 'File added' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not upload file', variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiClient.put<{ project: Project }>(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditDialogOpen(false);
      toast({ title: 'Project updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update project', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete<{ project: Project }>(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Project deleted' });
      navigate('/projects');
    },
    onError: () => toast({ title: 'Error', description: 'Could not delete project', variant: 'destructive' }),
  });

  const invoiceMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<{ invoice: Invoice }>('/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-invoices', id] });
      setDepositDialogOpen(false);
      setEditingInvoice(null);
      setInvoiceForm({ invoiceNumber: '', clientName: '', amount: '', status: 'draft', dueDate: '', issueDate: '', description: '' });
      toast({ title: 'Deposit saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not save deposit', variant: 'destructive' }),
  });

  const invoiceUpdateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put<{ invoice: Invoice }>(`/invoices/${editingInvoice?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-invoices', id] });
      setDepositDialogOpen(false);
      setEditingInvoice(null);
      setInvoiceForm({ invoiceNumber: '', clientName: '', amount: '', status: 'draft', dueDate: '', issueDate: '', description: '' });
      toast({ title: 'Deposit updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update deposit', variant: 'destructive' }),
  });

  const progressMutation = useMutation({
    mutationFn: (value: number) => apiClient.put<{ project: Project }>(`/projects/${id}`, { progress: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Progress updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update progress', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Project not found</div>
      </div>
    );
  }

  const budgetProgress = project.estimatedBudget > 0
    ? (expenseTotals.total / project.estimatedBudget) * 100
    : 0;

  const openEdit = () => {
    setEditForm({
      name: project.name || '',
      description: project.description || '',
      type: project.type || '',
      status: project.status || '',
      address: project.address || '',
      city: project.city || '',
      state: project.state || '',
      zipCode: project.zipCode || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      estimatedBudget: project.estimatedBudget?.toString() || '',
      actualCost: project.actualCost?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
                {project.name}
              </h1>
              <Badge className="uppercase tracking-wide text-[10px] sm:text-xs">{project.status}</Badge>
              <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs">{progressValue}%</Badge>
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 line-clamp-3 sm:line-clamp-none">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
          {project.status === 'IN_PROGRESS' && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">Progress</Label>
                <span className="text-sm font-semibold text-gray-900">{progressValue}%</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progressValue}
                  onChange={(e) => setProgressValue(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isFinite(progressValue) ? progressValue : 0}
                    onChange={(e) => {
                      const next = Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10)));
                      setProgressValue(Number.isFinite(next) ? next : 0);
                    }}
                    className="pr-7 text-right"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-600">
                    %
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => progressMutation.mutate(progressValue)}
                  disabled={progressMutation.isPending}
                >
                  {progressMutation.isPending ? 'Saving...' : 'Save Progress'}
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-stretch lg:justify-end gap-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openEdit} className="flex-1 lg:flex-none">
                  <Edit className="mr-2 h-4 w-4" />
                  <span className="sm:hidden">Edit</span>
                  <span className="hidden sm:inline">Edit Project</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    editMutation.mutate({
                      ...editForm,
                      estimatedBudget: editForm.estimatedBudget ? parseFloat(editForm.estimatedBudget) : 0,
                      actualCost: editForm.actualCost ? parseFloat(editForm.actualCost) : 0,
                    });
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                    <DialogDescription>Update project details</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="p-name">Name</Label>
                      <Input
                        id="p-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-type">Type</Label>
                      <Input
                        id="p-type"
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-status">Status</Label>
                      <Input
                        id="p-status"
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-budget">Estimated Budget</Label>
                      <Input
                        id="p-budget"
                        type="number"
                        value={editForm.estimatedBudget}
                        onChange={(e) => setEditForm({ ...editForm, estimatedBudget: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-actual">Actual Cost</Label>
                      <Input
                        id="p-actual"
                        type="number"
                        value={editForm.actualCost}
                        onChange={(e) => setEditForm({ ...editForm, actualCost: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="p-desc">Description</Label>
                      <textarea
                        id="p-desc"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-address">Address</Label>
                      <Input
                        id="p-address"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-city">City</Label>
                      <Input
                        id="p-city"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-state">State</Label>
                      <Input
                        id="p-state"
                        value={editForm.state}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-zip">Zip</Label>
                      <Input
                        id="p-zip"
                        value={editForm.zipCode}
                        onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-start">Start Date</Label>
                      <Input
                        id="p-start"
                        type="date"
                        value={editForm.startDate}
                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-end">End Date</Label>
                      <Input
                        id="p-end"
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={editMutation.isPending}>
                      {editMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={deleteMutation.isPending} className="flex-1 lg:flex-none">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
                <DialogHeader>
                  <DialogTitle>Delete project?</DialogTitle>
                  <DialogDescription>
                    This action permanently removes the project and its tasks/files. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="text-base">{project.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Budget Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{Math.round(budgetProgress)}%</div>
              <Progress value={budgetProgress} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="text-lg font-bold">{formatCurrency(project.estimatedBudget)}</div>
              <div className="text-sm text-gray-500">
                {formatCurrency(expenseTotals.total)} spent
              </div>
              <Progress value={budgetProgress} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {project.startDate ? formatDate(project.startDate) : 'No start date'}
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {project.endDate ? formatDate(project.endDate) : 'No end date'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Location */}
      <Card>
        <CardHeader>
          <CardTitle>Project Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Project Type</p>
            <p className="font-medium capitalize">{project.type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="font-medium">{project.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">City & State</p>
            <p className="font-medium">{project.city}, {project.state} {project.zipCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{formatDate(project.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar">
          <TabsList className="flex w-max min-w-full h-auto flex-nowrap gap-1 px-4 sm:px-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
            <TabsTrigger value="invoices">Deposits ({invoices.length})</TabsTrigger>
            <TabsTrigger value="project-invoices">Invoices ({projectInvoices.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({projectExpenses.length})</TabsTrigger>
            <TabsTrigger value="materials">Materials ({materials.length})</TabsTrigger>
            <TabsTrigger value="selections">Selections ({selections.length})</TabsTrigger>
            <TabsTrigger value="daily-logs">Daily Logs ({dailyLogs.length})</TabsTrigger>
            <TabsTrigger value="inspections">Inspections ({inspections.length})</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="files">Files ({documents.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{project.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funding vs Spend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative h-6 rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600"
                  style={{ width: `${Math.min(100, (depositTotals.total / budgetBaseline) * 100)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-rose-500 opacity-80"
                  style={{ width: `${Math.min(100, (expenseTotals.total / budgetBaseline) * 100)}%` }}
                />
                {expenseTotals.total > depositTotals.total && (
                  <div
                    className="absolute inset-y-[2px] border-2 border-dotted border-blue-300 rounded"
                    style={{
                      left: `${(depositTotals.total / budgetBaseline) * 100}%`,
                      width: `${Math.min(100, ((expenseTotals.total - depositTotals.total) / budgetBaseline) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Budget</p>
                  <p className="font-semibold">{formatCurrency(project.estimatedBudget)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Deposits</p>
                  <p className="font-semibold text-blue-600">{formatCurrency(depositTotals.total)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Expenses</p>
                  <p className="font-semibold text-rose-600">{formatCurrency(expenseTotals.total)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Remaining deposits</p>
                  <p className="font-semibold text-amber-600">{formatCurrency(depositTotals.total - expenseTotals.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Task Board</h3>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setIsTaskDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    taskMutation.mutate(taskForm);
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Add Task</DialogTitle>
                    <DialogDescription>Create a task for this project</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="t-title">Title</Label>
                      <Input
                        id="t-title"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-desc">Description</Label>
                      <textarea
                        id="t-desc"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      />
                    </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="t-status">Status</Label>
                        <Input
                          id="t-status"
                          value={taskForm.status}
                          onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as any })}
                          placeholder="todo | in_progress | done"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-priority">Priority</Label>
                        <Input
                          id="t-priority"
                          value={taskForm.priority}
                          onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="t-assignee">Assignee</Label>
                        <Input
                          id="t-assignee"
                          value={taskForm.assignedTo}
                          onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-due">Due Date</Label>
                        <Input
                          id="t-due"
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={taskMutation.isPending}>
                      {taskMutation.isPending ? 'Adding...' : 'Add Task'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['todo', 'in-progress', 'review', 'completed'].map((column) => {
              const columnTasks = tasks.filter((t) => {
                const normalized = t.status === 'in_progress' ? 'in-progress' : t.status === 'done' ? 'completed' : t.status;
                return normalized === column;
              });
              const title =
                column === 'todo'
                  ? 'To Do'
                  : column === 'in-progress'
                    ? 'In Progress'
                    : column === 'review'
                      ? 'Review'
                      : 'Completed';
              return (
                <div
                  key={column}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) {
                      taskUpdateMutation.mutate({ id: taskId, status: column });
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-800">{title}</span>
                    <Badge variant="secondary">{columnTasks.length}</Badge>
                  </div>
                  <div className="space-y-3 p-3 min-h-[200px]">
                    {columnTasks.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-6">No tasks</div>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-md border border-gray-200 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing active:opacity-60 active:scale-95 transition-all"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', task.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                        >
                          <div className="font-medium text-gray-900 text-sm">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">{task.assignedTo || 'Unassigned'}</span>
                            <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'secondary'} className="text-xs">
                              {task.priority}
                            </Badge>
                          </div>
                          <div className="mt-2">
                            <Select
                              value={column}
                              onValueChange={(newStatus) => taskUpdateMutation.mutate({ id: task.id, status: newStatus })}
                            >
                              <SelectTrigger className="h-6 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Project Deposits</h3>
              <p className="text-sm text-gray-500">Track deposits from clients or lenders and sync with budget.</p>
            </div>
            <Dialog
              open={depositDialogOpen}
              onOpenChange={(open) => {
                setDepositDialogOpen(open);
                if (!open) {
                  setEditingInvoice(null);
                  setInvoiceForm({ invoiceNumber: '', clientName: '', amount: '', status: 'draft', dueDate: '', issueDate: '', description: '' });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingInvoice(null);
                    setInvoiceForm({ invoiceNumber: '', clientName: '', amount: '', status: 'draft', dueDate: '', issueDate: '', description: '' });
                    setDepositDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deposit
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const amount = parseFloat(invoiceForm.amount) || 0;
                    const payload = {
                      invoiceNumber: invoiceForm.invoiceNumber || `INV-${Date.now()}`,
                      projectId: id,
                      projectName: project?.name,
                      clientName: invoiceForm.clientName || 'Client',
                      amount,
                      status: invoiceForm.status,
                      dueDate: invoiceForm.dueDate,
                      issueDate: invoiceForm.issueDate,
                      description: invoiceForm.description,
                      type: 'deposit',
                    };
                    if (editingInvoice) {
                      invoiceUpdateMutation.mutate(payload);
                    } else {
                      invoiceMutation.mutate(payload);
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{editingInvoice ? 'Edit Deposit' : 'Add Deposit'}</DialogTitle>
                    <DialogDescription>Record a deposit from a client or bank.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
                    <div className="space-y-2">
                      <Label>Deposit #</Label>
                      <Input
                        value={invoiceForm.invoiceNumber}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                        placeholder="INV-2025-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client / Payer</Label>
                      <Input
                        value={invoiceForm.clientName}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })}
                        placeholder="Client or lender"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={invoiceForm.status}
                        onValueChange={(val) => setInvoiceForm({ ...invoiceForm, status: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Issue Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.issueDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={invoiceForm.description}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                        placeholder="Notes about this deposit"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={invoiceMutation.isPending || invoiceUpdateMutation.isPending}>
                      {editingInvoice
                        ? invoiceUpdateMutation.isPending ? 'Saving...' : 'Update'
                        : invoiceMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Deposits</CardTitle>
                <Badge variant="secondary">Total: {formatCurrency(depositTotals.total)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">
                        No invoices yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.clientName}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'secondary'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(inv.amount)}</TableCell>
                      <TableCell>{inv.issueDate ? formatDate(inv.issueDate) : '-'}</TableCell>
                      <TableCell>{inv.dueDate ? formatDate(inv.dueDate) : '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.description || '-'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingInvoice(inv);
                            setInvoiceForm({
                              invoiceNumber: inv.invoiceNumber,
                              clientName: inv.clientName,
                              amount: String(inv.amount || ''),
                              status: inv.status as any,
                              dueDate: inv.dueDate || '',
                              issueDate: inv.issueDate || '',
                              description: inv.description || '',
                            });
                            setDepositDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" /> Linked Schedule
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{scheduleEvents.length} items</Badge>
                <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
                  Open Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduleEvents.length === 0 && (
                <p className="text-sm text-gray-500">No events yet. Add schedule items from the Schedule page.</p>
              )}
              {scheduleEvents.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                      <MapPin className="h-3 w-3" /> {ev.location || 'On site'}
                      {ev.assignee ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <span>{ev.assignee}</span>
                        </>
                      ) : null}
                      {ev.type ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="uppercase tracking-wide">{ev.type}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {ev.startDate ? (
                      <span>
                        {formatDate(ev.startDate)}
                        {ev.endDate && ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate)}` : ''}
                      </span>
                    ) : (
                      'TBD'
                    )}
                  </div>
                </div>
              ))}
              {tasks.filter(t => !!t.dueDate).length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Project tasks with due dates</p>
                  <div className="space-y-2">
                    {tasks
                      .filter(t => !!t.dueDate)
                      .slice(0, 6)
                      .map(t => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="text-sm font-medium text-gray-900">{t.title}</span>
                          <span className="text-xs text-gray-600">{formatDate(t.dueDate!)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project-invoices" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Project Invoices
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                Open Invoices
              </Button>
            </CardHeader>
            <CardContent>
              {projectInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">No invoices linked to this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectInvoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.clientName}</TableCell>
                        <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-rose-600" /> Project Expenses
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/expenses')}>
                Open Expenses
              </Button>
            </CardHeader>
            <CardContent>
              {projectExpenses.length === 0 ? (
                <p className="text-sm text-gray-500">No expenses linked to this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectExpenses.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.title || 'Expense'}</TableCell>
                        <TableCell>{e.category || '—'}</TableCell>
                        <TableCell>{e.vendor || '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(e.total ?? (e.amount || 0) + (e.tax || 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600" /> Project Materials
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/materials')}>
                Open Materials
              </Button>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <p className="text-sm text-gray-500">No materials linked to this project yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-sm text-gray-500">{m.supplier || '—'}</TableCell>
                          <TableCell className="text-right text-sm">{m.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.totalCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selections" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LayoutPanelTop className="h-4 w-4 text-indigo-600" /> Project Selections
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/selections')}>
                Open Selections
              </Button>
            </CardHeader>
            <CardContent>
              {selections.length === 0 ? (
                <p className="text-sm text-gray-500">No selections linked to this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selections.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.category}</TableCell>
                        <TableCell>{s.item}</TableCell>
                        <TableCell><Badge variant="secondary">{s.status || 'pending'}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(s.cost || 0)}</TableCell>
                        <TableCell>{s.dueDate ? formatDate(s.dueDate) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily-logs" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600" /> Daily Logs
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/daily-logs')}>
                Open Daily Logs
              </Button>
            </CardHeader>
            <CardContent>
              {dailyLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No daily logs linked to this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Weather</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyLogs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.date ? formatDate(l.date) : '—'}</TableCell>
                        <TableCell>{l.weather || '—'} {l.temperature ? `(${l.temperature})` : ''}</TableCell>
                        <TableCell>{l.crewSize ?? '—'}</TableCell>
                        <TableCell>{l.hoursWorked ?? '—'}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{l.workPerformed || l.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" /> Inspections
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/inspections')}>
                Open Inspections
              </Button>
            </CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <p className="text-sm text-gray-500">No inspections linked to this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Inspector</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspections.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.title || 'Inspection'}</TableCell>
                        <TableCell><Badge variant="secondary">{i.status || 'scheduled'}</Badge></TableCell>
                        <TableCell>{i.scheduledDate ? formatDate(i.scheduledDate) : '—'}</TableCell>
                        <TableCell>{i.inspector || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LayoutPanelTop className="h-4 w-4 text-indigo-600" /> Project Plan (Gantt style)
              </CardTitle>
              <Badge variant="secondary">Timeline</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {combinedPlanItems.length === 0 && (
                <p className="text-sm text-gray-500">No scheduled items yet.</p>
              )}
              <div className="space-y-3">
                {combinedPlanItems.map((ev) => {
                  const start = ev.startDate ? new Date(ev.startDate) : new Date();
                  const end = ev.endDate ? new Date(ev.endDate) : start;
                  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                  return (
                    <div key={ev.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <span className="font-semibold">{ev.title}</span>
                        <span>{formatDate(start.toISOString())} - {formatDate(end.toISOString())}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                        <div
                          className="h-3 bg-gradient-to-r from-blue-500 to-indigo-500"
                          style={{ width: `${Math.min(days * 10, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BookOpen className="h-5 w-5 text-blue-600" /> Project Docs
            </h2>
            <div className="flex gap-2">
              <Input
                placeholder="Search pages..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="w-[180px]"
              />
              <Button
                size="sm"
                disabled={createPageMutation.isPending}
                onClick={() => {
                  createPageMutation.mutate({
                    title: `Untitled Page`,
                    content: '',
                    images: [],
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> New Page
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            {/* Sidebar: page list */}
            <div className="space-y-1.5">
              {filteredDocPages.map((page) => (
                <div
                  key={page.id}
                  className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 ${
                    selectedPageId === page.id
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                      : 'border-slate-200 text-slate-700'
                  }`}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{page.title || 'Untitled'}</span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-600 transition"
                    disabled={deletePageMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
                      deletePageMutation.mutate(page.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {filteredDocPages.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-4">
                  {docPages.length === 0 ? 'No pages yet.' : 'No pages match.'}
                </p>
              )}
            </div>

            {/* Editor panel */}
            <div className="space-y-3">
              {selectedPage ? (
                <>
                  {/* Title */}
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => {
                      if (draftTitle !== selectedPage.title) {
                        updatePageMutation.mutate({ pageId: selectedPage.id, title: draftTitle });
                      }
                    }}
                    className="text-xl font-bold border-none shadow-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-300"
                    placeholder="Untitled"
                  />

                  {/* Rich editor */}
                  <RichDocEditor
                    key={selectedPage.id}
                    content={selectedPage.content || ''}
                    title={draftTitle}
                    isSaving={updatePageMutation.isPending}
                    onContentSave={(html) => {
                      updatePageMutation.mutate({ pageId: selectedPage.id, content: html });
                    }}
                    onTitleSave={(t) => {
                      setDraftTitle(t);
                      updatePageMutation.mutate({ pageId: selectedPage.id, title: t });
                    }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center">
                  <BookOpen className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Select a page or create one</p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => createPageMutation.mutate({ title: 'Untitled Page', content: '', images: [] })}
                  >
                    <Plus className="h-4 w-4 mr-1" /> New Page
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Budgeted</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">
                        No budget items yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgetItems.map((item) => {
                      const variance = item.budgetedAmount - item.actualAmount;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell>{formatCurrency(item.budgetedAmount)}</TableCell>
                          <TableCell>{formatCurrency(item.actualAmount)}</TableCell>
                          <TableCell className={variance < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs(variance))} {variance < 0 ? 'over' : 'under'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setIsDocDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add File
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!projectFile) {
                            toast({ title: 'Select a file', description: 'Choose a file to upload', variant: 'destructive' });
                            return;
                          }
                          try {
                            const fd = new FormData();
                            fd.append('file', projectFile);
                            fd.append('projectId', id || '');
                            fd.append('folder', folderPath || '');
                            const uploadResp = await apiClient.post<{ url: string; key: string; name: string; size: number; type: string }>(
                              '/documents/upload',
                              fd,
                              { headers: { 'Content-Type': 'multipart/form-data' } }
                            );
                            docMutation.mutate({
                              name: docForm.name || uploadResp.name,
                              category: docForm.category,
                              type: uploadResp.type || projectFile.type || 'file',
                              fileSize: uploadResp.size,
                              mimeType: uploadResp.type,
                              url: uploadResp.url,
                              key: uploadResp.key,
                              projectId: id,
                              projectName: project?.name,
                            });
                            setIsDocDialogOpen(false);
                            setProjectFile(null);
                            setFolderPath('');
                            setDocForm({ name: '', type: 'file', category: 'other', fileSize: '', mimeType: '', url: '', key: '' });
                            queryClient.invalidateQueries({ queryKey: ['project-documents', id] });
                          } catch (err) {
                            toast({ title: 'Upload failed', description: 'Please try again', variant: 'destructive' });
                          }
                        }}
                      >
                        <DialogHeader>
                          <DialogTitle>Upload File</DialogTitle>
                          <DialogDescription>Add a document for this project</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="d-name">Name</Label>
                            <Input
                              id="d-name"
                              value={docForm.name}
                              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                              placeholder={projectFile?.name || 'Document name'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>File</Label>
                            <div className="flex items-center gap-3">
                              <Button type="button" variant="outline" onClick={() => docFileRef.current?.click()}>
                                Choose File
                              </Button>
                              {projectFile && <span className="text-sm text-gray-600">{projectFile.name}</span>}
                            </div>
                            <input
                              ref={docFileRef}
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setProjectFile(file);
                            setDocForm((prev) => ({ ...prev, name: prev.name || file.name, mimeType: file.type }));
                          }
                        }}
                      />
                    </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Input
                                value={docForm.category}
                                onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Subfolder</Label>
                              <Input
                                placeholder="e.g. contracts/2024"
                                value={folderPath}
                                onChange={(e) => setFolderPath(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsDocDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={docMutation.isPending}>
                            {docMutation.isPending ? 'Uploading...' : 'Upload'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFolderPath(prev => prev || 'new-folder');
                      toast({ title: 'Folder ready', description: 'Set your subfolder in the upload form.' });
                    }}
                  >
                    New Folder
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No documents yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{doc.category}</TableCell>
                        <TableCell>{doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}</TableCell>
                        <TableCell>{doc.uploadedBy}</TableCell>
                        <TableCell>{formatDate(doc.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectDetailPage;
