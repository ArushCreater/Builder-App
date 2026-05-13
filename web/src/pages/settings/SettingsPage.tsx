import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { useToast } from '../../components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { getInitials } from '../../lib/utils';
import { Bell, Mail } from 'lucide-react';

export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateUser(profileData);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    setIsPasswordLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Success', description: 'Password updated successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update password', variant: 'destructive' });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleSavePreferences = () => {
    toast({ title: 'Preferences saved', description: 'Your preferences have been updated' });
  };

  // ── Notification recipients (saved on backend) ─────────────────────────────
  const queryClient = useQueryClient();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');

  const { data: notifData, isLoading: notifLoading } = useQuery({
    queryKey: ['settings-notifications'],
    queryFn: () => apiClient.get<{ recipients: string[] }>('/settings/notifications'),
  });

  useEffect(() => {
    if (notifData?.recipients) setRecipients(notifData.recipients);
  }, [notifData]);

  const saveNotificationsMutation = useMutation({
    mutationFn: (list: string[]) => apiClient.put<{ recipients: string[] }>('/settings/notifications', { recipients: list }),
    onSuccess: (data) => {
      setRecipients(data.recipients);
      queryClient.invalidateQueries({ queryKey: ['settings-notifications'] });
      toast({ title: 'Notification recipients saved' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.message || 'Could not save', variant: 'destructive' }),
  });

  const addRecipient = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '');
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: 'Invalid email', description: trimmed, variant: 'destructive' });
      return;
    }
    if (recipients.includes(trimmed)) return;
    setRecipients([...recipients, trimmed]);
    setRecipientInput('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="text-lg">
                      {user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button type="button" variant="outline" size="sm">
                      Change Avatar
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">JPG, PNG or GIF. Max 2MB</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={profileData.firstName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={profileData.lastName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={profileData.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      name="company"
                      value={profileData.company}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={isPasswordLoading}>
                  {isPasswordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-500" />
                <div>
                  <CardTitle>Reminder Recipients</CardTitle>
                  <CardDescription>
                    Everyone listed here automatically receives the 24-hour reminder for every schedule event and task with a due date.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 flex items-center gap-1.5 text-slate-700">
                  <Mail className="h-4 w-4" /> Email addresses
                </Label>
                <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 min-h-[44px] focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300">
                  {recipients.map((email) => (
                    <span key={email} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 text-indigo-700 text-sm font-medium px-2 py-1 border border-indigo-100">
                      {email}
                      <button
                        type="button"
                        onClick={() => setRecipients(recipients.filter(e => e !== email))}
                        className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
                        if (recipientInput.trim()) {
                          e.preventDefault();
                          addRecipient(recipientInput);
                        }
                      } else if (e.key === 'Backspace' && !recipientInput && recipients.length) {
                        setRecipients(recipients.slice(0, -1));
                      }
                    }}
                    onBlur={() => { if (recipientInput.trim()) addRecipient(recipientInput); }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (/[\s,;]/.test(pasted)) {
                        e.preventDefault();
                        pasted.split(/[\s,;]+/).forEach(part => addRecipient(part));
                      }
                    }}
                    placeholder={recipients.length ? '' : 'Type an email and press Enter'}
                    className="flex-1 min-w-[200px] bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400 py-1"
                    disabled={notifLoading}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Press Enter or comma to add. Backspace deletes the last one. These addresses receive every reminder 24 hours before the event/task starts.
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
                <strong>Tip:</strong> Once saved, you don't need to add a reminder email when creating a schedule event or task — the people listed here get notified automatically. You can still set an additional one-off recipient on individual events if you want.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => saveNotificationsMutation.mutate(recipients)}
                  disabled={saveNotificationsMutation.isPending || notifLoading}
                >
                  {saveNotificationsMutation.isPending ? 'Saving…' : 'Save recipients'}
                </Button>
                {notifData && JSON.stringify(notifData.recipients) !== JSON.stringify(recipients) && (
                  <Button variant="ghost" onClick={() => setRecipients(notifData.recipients || [])}>
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Input defaultValue="English (US)" />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input defaultValue="(GMT-5:00) Eastern Time" />
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Input defaultValue="MM/DD/YYYY" />
              </div>
              <Button type="button" onClick={handleSavePreferences}>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SettingsPage;
