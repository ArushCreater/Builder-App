import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
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
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Mail, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { formatDate, getInitials } from '../../lib/utils';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'manager' | 'contractor' | 'client';
  phone: string;
  avatar?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

const roleColors = {
  'admin': 'destructive',
  'manager': 'default',
  'contractor': 'secondary',
  'client': 'success',
} as const;

export function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    role: User['role'];
    phone: string;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'contractor',
    phone: '',
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      return apiClient.get<User[]>(`/users?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<User>) => apiClient.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateDialogOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: 'contractor',
        phone: '',
      });
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingId(null);
      toast({ title: 'Deleted', description: 'User removed successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' }),
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as Partial<User>);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Users</h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Manage team members and access</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new user account</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: User['role']) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden rounded-2xl sm:rounded-lg">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {users?.length ? (
                  users.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {getInitials(`${user.firstName} ${user.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">
                                {user.firstName} {user.lastName}
                              </h3>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant={roleColors[user.role]}>{user.role}</Badge>
                                <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>{user.status}</Badge>
                              </div>
                            </div>
                            <ConfirmDialog
                              title="Delete user?"
                              description="This will permanently remove the user. This cannot be undone."
                              confirmText="Delete"
                              confirmVariant="destructive"
                              confirmDisabled={deleteMutation.isPending && deletingId === user.id}
                              onConfirm={() => { setDeletingId(user.id); deleteMutation.mutate(user.id); }}
                              trigger={
                                <Button variant="outline" size="icon" className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <p className="flex min-w-0 items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{user.email}</span>
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{user.phone || '-'}</span>
                            </p>
                            <p><span className="font-medium text-slate-700">Created:</span> {formatDate(user.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">No users found</p>
                    <p className="mt-1 text-sm text-slate-500">Try a different search.</p>
                  </div>
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {getInitials(`${user.firstName} ${user.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[user.role]}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <ConfirmDialog
                          title="Delete user?"
                          description="This will permanently remove the user. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending && deletingId === user.id}
                          onConfirm={() => { setDeletingId(user.id); deleteMutation.mutate(user.id); }}
                          trigger={
                            <Button variant="ghost" size="sm">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersPage;
