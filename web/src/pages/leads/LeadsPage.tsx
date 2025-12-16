import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
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
import { Plus, Search, Mail, Phone, Eye, Pencil, Trash, User, Calendar, DollarSign, Building } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import ConfirmDialog from '../../components/ConfirmDialog';
interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  source: string;
  estimatedValue: number;
  createdAt: string;
  notes?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
  contacted: { label: 'Contacted', className: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200' },
  qualified: { label: 'Qualified', className: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200' },
  proposal: { label: 'Proposal', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
  won: { label: 'Won', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
  lost: { label: 'Lost', className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
};

export function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: '',
    estimatedValue: '',
    notes: '',
  });

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', searchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return apiClient.get<{ leads: Lead[] }>(`/leads?${params}`);
    },
  });

  const leads = leadsData?.leads || [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<Lead>) => apiClient.post('/leads', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsDialogOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        source: '',
        estimatedValue: '',
        notes: '',
      });
      toast({
        title: 'Success',
        description: 'Lead created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create lead',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Lead> & { id: string }) =>
      apiClient.put(`/leads/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsDialogOpen(false);
      setEditingLead(null);
      toast({
        title: 'Updated',
        description: 'Lead updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lead',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Deleted', description: 'Lead removed' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete lead',
        variant: 'destructive',
      });
    },
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : 0,
    };
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const openCreate = () => {
    setEditingLead(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      source: '',
      estimatedValue: '',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      estimatedValue: lead.estimatedValue?.toString() || '',
      notes: lead.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">Manage and track your sales pipeline</p>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={openCreate} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <form onSubmit={handleCreateLead}>
                <DialogHeader>
                    <DialogTitle>{editingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
                    <DialogDescription>
                    {editingLead ? 'Update lead details' : 'Add a new lead to your pipeline'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        />
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        />
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Input
                        id="source"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        placeholder="e.g., Website, Referral"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="estimatedValue">Estimated Value</Label>
                        <Input
                        id="estimatedValue"
                        name="estimatedValue"
                        type="number"
                        value={formData.estimatedValue}
                        onChange={handleChange}
                        placeholder="0"
                        />
                    </div>
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Additional notes..."
                    />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                    </Button>
                    <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    >
                    {editingLead
                        ? updateMutation.isPending
                        ? 'Saving...'
                        : 'Save Changes'
                        : createMutation.isPending
                        ? 'Creating...'
                        : 'Create Lead'}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search leads by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <p className="text-slate-500 text-sm">Loading leads...</p>
                </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 w-[250px]">Name & Contact</th>
                            <th className="px-6 py-4 w-[150px]">Status</th>
                            <th className="px-6 py-4">Value & Source</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {leads.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="bg-slate-100 p-3 rounded-full mb-3">
                                            <User className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p className="font-medium text-slate-900">No leads found</p>
                                        <p className="text-sm mt-1">Try adjusting your filters or add a new lead.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            leads.map((lead) => (
                                <tr key={lead.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-9 w-9 border border-slate-200 bg-white shadow-sm mt-0.5">
                                                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-medium text-xs">
                                                    {lead.firstName[0]}{lead.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-semibold text-slate-900">
                                                    {lead.firstName} {lead.lastName}
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="h-3 w-3" />
                                                        {lead.email}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="h-3 w-3" />
                                                        {lead.phone}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top pt-5">
                                        <Badge variant="outline" className={cn("font-medium", statusConfig[lead.status]?.className)}>
                                            {statusConfig[lead.status]?.label || lead.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                                                {lead.estimatedValue.toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Building className="h-3 w-3" />
                                                {lead.source || 'Unknown Source'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top pt-5">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(lead.createdAt)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-right pt-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-400 hover:text-indigo-600" 
                                                onClick={() => navigate(`/leads/${lead.id}`)}
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-400 hover:text-indigo-600" 
                                                onClick={() => openEdit(lead)}
                                                title="Edit Lead"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                              <ConfirmDialog
                                                title="Delete lead?"
                                                description="This permanently removes the lead. This cannot be undone."
                                                confirmText="Delete"
                                                confirmVariant="destructive"
                                                confirmDisabled={deleteMutation.isPending}
                                                onConfirm={() => handleDelete(lead.id)}
                                                trigger={
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                                                    title="Delete Lead"
                                                  >
                                                    <Trash className="h-4 w-4" />
                                                  </Button>
                                                }
                                              />
                                          </div>
                                      </td>
                                  </tr>
                              ))
                        )}
                    </tbody>
                </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LeadsPage;
