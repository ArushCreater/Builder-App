import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Mail, Phone, MapPin, Trash2, Pencil, Briefcase, Building2, LayoutGrid, List, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  officeNumber?: string;
  address?: string;
  designation?: string;
  createdAt?: string;
  favorite?: boolean;
  isClient?: boolean;
}

export function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'clients'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    officeNumber: '',
    address: '',
    designation: '',
    favorite: false,
    isClient: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, tab],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (tab === 'clients') qs.set('type', 'clients');
      const params = qs.toString() ? `?${qs.toString()}` : '';
      return apiClient.get<{ contacts: Contact[] }>(`/contacts${params}`);
    },
  });

  const contacts = data?.contacts || [];
  const totalCount = contacts.length;
  const clientCount = contacts.filter(c => c.isClient).length;
  const favorites = contacts.filter(c => c.favorite);
  const others = contacts.filter(c => !c.favorite).sort((a, b) => a.name.localeCompare(b.name));

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      company: '',
      officeNumber: '',
      address: '',
      designation: '',
      favorite: false,
      isClient: tab === 'clients', // pre-check when adding from the Clients tab
    });
    setEditing(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Contact>) => apiClient.post('/contacts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      resetForm();
      setIsDialogOpen(false);
      toast({ title: 'Contact saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not save contact', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Contact> }) =>
      apiClient.put(`/contacts/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      resetForm();
      setIsDialogOpen(false);
      toast({ title: 'Contact updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update contact', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not delete contact', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      name: contact.name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      company: contact.company || '',
      officeNumber: contact.officeNumber || '',
      address: contact.address || '',
      designation: contact.designation || '',
      favorite: !!contact.favorite,
      isClient: !!contact.isClient,
    });
    setIsDialogOpen(true);
  };

  const renderContactList = (list: Contact[]) => (
    view === 'grid' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {list.map((contact) => (
          <div key={contact.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative">
            <button
              className={`absolute top-3 right-3 transition-colors z-10 ${contact.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
              onClick={(e) => {
                e.stopPropagation();
                updateMutation.mutate({ id: contact.id, data: { favorite: !contact.favorite } });
              }}
              aria-label="Toggle favorite"
            >
              <Star className={`h-5 w-5 ${contact.favorite ? 'fill-amber-400' : ''}`} />
            </button>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
                  <AvatarFallback className="bg-indigo-50 text-indigo-600 font-semibold">
                    {contact.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-slate-900 line-clamp-1">{contact.name}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-1">
                    {contact.designation || 'No Designation'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-6">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-400 hover:text-indigo-600" 
                  onClick={() => startEdit(contact)}
                  title="Edit Contact"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <ConfirmDialog
                  title="Delete contact?"
                  description="This permanently removes the contact. This cannot be undone."
                  confirmText="Delete"
                  confirmVariant="destructive"
                  confirmDisabled={deleteMutation.isPending}
                  onConfirm={() => deleteMutation.mutate(contact.id)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      title="Delete Contact"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{contact.company || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{contact.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{contact.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{contact.address || '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-[300px]">Name & Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((contact) => (
              <TableRow key={contact.id} className="group hover:bg-slate-50/50">
                <TableCell className="align-top py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-slate-200">
                      <AvatarFallback className="bg-indigo-50 text-indigo-600 font-medium text-xs">
                        {contact.name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-slate-900">{contact.name}</div>
                      <div className="text-xs text-slate-500">{contact.designation || 'No Designation'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {contact.company || '—'}
                  </div>
                </TableCell>
                <TableCell className="align-top py-4">
                  <div className="flex flex-col gap-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {contact.email || '—'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {contact.phone || '—'}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top py-4">
                  <div className="flex items-start gap-2 text-sm text-slate-600 max-w-[200px]">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="truncate">{contact.address || '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${contact.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
                      onClick={() => updateMutation.mutate({ id: contact.id, data: { favorite: !contact.favorite } })}
                      title="Toggle favorite"
                    >
                      <Star className={`h-4 w-4 ${contact.favorite ? 'fill-amber-400' : ''}`} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600" 
                      onClick={() => startEdit(contact)}
                      title="Edit Contact"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="Delete contact?"
                      description="This permanently removes the contact. This cannot be undone."
                      confirmText="Delete"
                      confirmVariant="destructive"
                      confirmDisabled={deleteMutation.isPending}
                      onConfirm={() => deleteMutation.mutate(contact.id)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          title="Delete Contact"
                        >
                          <Trash2 className="h-4 w-4" />
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
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Contacts</h1>
          <p className="text-gray-500 mt-1">Central rolodex for clients, partners, and vendors</p>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { resetForm(); } }}>
            <DialogTrigger asChild>
                <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit Contact' : 'New Contact'}</DialogTitle>
                    <DialogDescription>Capture key contact details. Only name is required.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                    <Label>Office Number</Label>
                    <Input value={form.officeNumber} onChange={(e) => setForm({ ...form, officeNumber: e.target.value })} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                    <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.isClient}
                        onChange={(e) => setForm({ ...form, isClient: e.target.checked })}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-800">Mark as client</span>
                      <span className="text-xs text-slate-500">— appears under the Clients tab</span>
                    </label>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }}>
                    Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editing ? (updateMutation.isPending ? 'Saving...' : 'Save') : (createMutation.isPending ? 'Creating...' : 'Create')}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 space-y-4">
          {/* Section tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 -mb-4 pb-0">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'all'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              All
              {tab === 'all' && <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-700 px-1.5">{totalCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setTab('clients')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'clients'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Clients
              {tab === 'clients' && <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-700 px-1.5">{clientCount}</span>}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-2">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={tab === 'clients' ? 'Search clients...' : 'Search contacts...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Button
                variant={view === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 ${view === 'grid' ? 'shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 ${view === 'list' ? 'shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <p className="text-slate-500 text-sm">Loading contacts...</p>
                </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {contacts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                        <div className="bg-slate-100 p-3 rounded-full mb-3">
                            <Briefcase className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="font-medium text-slate-900">
                          {tab === 'clients' ? 'No clients yet' : 'No contacts found'}
                        </p>
                        <p className="text-sm mt-1">
                          {tab === 'clients'
                            ? 'Add a contact and check "Mark as client" to see them here.'
                            : 'Add a new contact to get started.'}
                        </p>
                    </div>
                </div>
              ) : (
                <>
                  {/* Favorites Section */}
                  {favorites.length > 0 && (
                    <div className="mb-6">
                      <div className="mx-4 mt-4 mb-2 flex items-center gap-2 text-amber-700 text-xs font-semibold uppercase tracking-wider">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        Favorites
                      </div>
                      <div className="bg-amber-50/30 rounded-xl border border-amber-100/50 overflow-hidden mx-4">
                        {renderContactList(favorites)}
                      </div>
                    </div>
                  )}

                  {/* All Contacts Section */}
                  <div>
                    {favorites.length > 0 && (
                      <div className="mx-4 mb-2 flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        All Contacts
                      </div>
                    )}
                    <div className={favorites.length > 0 ? "bg-white rounded-xl border border-slate-200 overflow-hidden mx-4 mb-4" : ""}>
                      {renderContactList(others)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactsPage;
