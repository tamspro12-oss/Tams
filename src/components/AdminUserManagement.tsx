import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2, Users } from 'lucide-react';
import { UserManagementList } from './UserManagementList';

export const AdminUserManagement = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    agency_name: '',
    subscription_plan: 'free'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.full_name || !formData.agency_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          agency_name: formData.agency_name,
          subscription_plan: formData.subscription_plan
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success('User created successfully!');
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        agency_name: '',
        subscription_plan: 'free'
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs defaultValue="manage" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="manage" className="gap-2">
          <Users className="h-4 w-4" />
          Manage Users
        </TabsTrigger>
        <TabsTrigger value="create" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manage">
        <UserManagementList />
      </TabsContent>

      <TabsContent value="create">
        <Card className="border-border/50 shadow-soft-md">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Create New User</CardTitle>
                <CardDescription>Add a new user account with subscription plan</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm font-medium">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                type="text"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agency_name" className="text-sm font-medium">
                Agency Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="agency_name"
                type="text"
                placeholder="Travel Agency Ltd."
                value={formData.agency_name}
                onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="subscription_plan" className="text-sm font-medium">
                Subscription Plan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.subscription_plan}
                onValueChange={(value) => setFormData({ ...formData, subscription_plan: value })}
                disabled={loading}
              >
                <SelectTrigger id="subscription_plan">
                  <SelectValue placeholder="Select subscription plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Free Trial</span>
                      <span className="text-xs text-muted-foreground">14 days access</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="monthly">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Monthly Plan</span>
                      <span className="text-xs text-muted-foreground">32 days access</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="yearly">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Yearly Plan</span>
                      <span className="text-xs text-muted-foreground">370 days access</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full md:w-auto"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating User...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </>
            )}
          </Button>
        </form>
      </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
