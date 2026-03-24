import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/context/AppContext';
import { User, UserRole } from '@/types';
import { toast } from 'sonner';
import { userService } from '@/services/userService';
import { regionService } from '@/services/regionService';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

interface Region {
  _id?: string;
  name: string;
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const { users, setUsers } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '' as UserRole | '',
    region: '',
    phone: '',
    isActive: true,
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load regions on mount
  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setIsLoadingRegions(true);
      const data = await regionService.getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Error loading regions:', error);
      setRegions([]);
    } finally {
      setIsLoadingRegions(false);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        region: user.region || '',
        phone: user.phone || '',
        isActive: user.isActive !== false,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const userId = user?.id || user?._id;
      if (!userId) {
        toast.error('User ID not found');
        return;
      }

      const response = await userService.update(userId as string, {
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        region: formData.region || undefined,
        phone: formData.phone || undefined,
        isActive: formData.isActive,
      });

      // Update local state
      const updatedUser = response.data;
      setUsers(prev => prev.map(u => {
        if (u.id === userId || u._id === userId) {
          return {
            ...u,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            region: updatedUser.region,
            phone: updatedUser.phone,
            isActive: updatedUser.isActive,
          };
        }
        return u;
      }));
      
      toast.success('User updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update user');
      console.error('Error updating user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+254..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="field_officer">Field Officer</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="regional_manager">Regional Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-region">Region</Label>
            <Select
              value={formData.region}
              onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
              disabled={isLoadingRegions}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingRegions ? "Loading regions..." : "Select region"} />
              </SelectTrigger>
              <SelectContent>
                {regions.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No regions available
                  </div>
                ) : (
                  regions.map(region => (
                    <SelectItem key={region._id || region.name} value={region.name}>
                      {region.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="edit-active">Active Status</Label>
              <p className="text-sm text-muted-foreground">User can log in when active</p>
            </div>
            <Switch
              id="edit-active"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
          </div>

          <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="btn-brand w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
