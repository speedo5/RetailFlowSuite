import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { UserRole } from '@/types';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { userService } from '@/services/userService';
import { regionService } from '@/services/regionService';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userType?: 'system' | 'field_officer';
}

interface Region {
  _id?: string;
  name: string;
}

export function CreateUserDialog({ open, onOpenChange, userType = 'system' }: CreateUserDialogProps) {
  const { users, setUsers } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: userType === 'field_officer' ? ('field_officer' as UserRole | '') : ('' as UserRole | ''),
    region: '',
    phone: '',
  });
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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: userType === 'field_officer' ? ('field_officer' as UserRole | '') : ('' as UserRole | ''),
        region: '',
        phone: '',
      });
    }
  }, [open, userType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await userService.create({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as UserRole,
        region: formData.region || undefined,
        phone: formData.phone || undefined,
      });

      // Add the new user to local state
      const newUser = response.data;
      setUsers(prev => [...prev, {
        id: newUser.id || newUser._id,
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        region: newUser.region,
        phone: newUser.phone,
        foCode: newUser.foCode,
        createdAt: newUser.createdAt ? new Date(newUser.createdAt) : new Date(),
        isActive: newUser.isActive !== false,
      }]);
      
      toast.success(`${formData.role.replace('_', ' ')} account created successfully`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create user');
      console.error('Error creating user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create New {userType === 'field_officer' ? 'Field Officer' : 'System User'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+254..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
              disabled={userType !== 'system'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {userType === 'system' ? (
                  <>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="regional_manager">Regional Manager</SelectItem>
                  </>
                ) : (
                  <SelectItem value="field_officer">Field Officer</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
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

          <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="btn-brand w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
