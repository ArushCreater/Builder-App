import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
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
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Search, Mail, Phone, MapPin, Trash2, Pencil } from 'lucide-react';

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
}

export function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
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
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiClient.get<{ contacts: Contact[] }>(`/contacts${params}`);
    },
  });

  const contacts = data?.contacts || [];

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      company: '',
      officeNumber: '',
      address: '',
      designation: '',
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
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 mt-1">Central rolodex for clients, partners, vendors, and team.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { resetForm(); } }}>
          <DialogTrigger asChild>
            <Button>
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

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg text-gray-800">Directory</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">Loading contacts...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No contacts yet.
                    </TableCell>
                  </TableRow>
                )}
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-semibold text-gray-900">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{contact.name?.[0]?.toUpperCase() || '?'}</Badge>
                        <div className="flex flex-col">
                          <span>{contact.name}</span>
                          {contact.createdAt && <span className="text-xs text-gray-400">Added {contact.createdAt.split('T')[0]}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{contact.company || '-'}</TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <span className="inline-flex items-center gap-1 text-gray-800">
                          <Phone className="h-4 w-4 text-gray-400" /> {contact.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <span className="inline-flex items-center gap-1 text-gray-800">
                          <Mail className="h-4 w-4 text-gray-400" /> {contact.email}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{contact.designation || '-'}</TableCell>
                    <TableCell>
                      {contact.address ? (
                        <span className="inline-flex items-center gap-1 text-gray-800">
                          <MapPin className="h-4 w-4 text-gray-400" /> {contact.address}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(contact)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(contact.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactsPage;
