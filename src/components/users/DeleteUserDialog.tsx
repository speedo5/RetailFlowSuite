import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useApp } from '@/context/AppContext';
import { User } from '@/types';
import { toast } from 'sonner';
import { userService } from '@/services/userService';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const { setUsers, currentUser, logActivity } = useApp();

  const handleDelete = async () => {
    if (!user) return;

    if (user.id === currentUser?.id) {
      toast.error('You cannot delete your own account');
      onOpenChange(false);
      return;
    }

    try {
      const userId = user.id || user._id;
      if (!userId) {
        toast.error('User ID not found');
        return;
      }

      await userService.delete(userId as string);

      // Soft delete - set isActive to false in local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId || u._id === userId) {
          return { ...u, isActive: false };
        }
        return u;
      }));
      
      toast.success(`${user.name} has been deactivated`);
      try {
        logActivity('user', 'Deactivate User', `Deactivated user ${user.name}`, { userId, userName: user.name });
      } catch (e) {
        console.warn('Failed to log user deactivation activity:', e);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to deactivate user');
      console.error('Error deactivating user:', error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate <strong>{user?.name}</strong>? 
            This will prevent them from logging in. You can reactivate them later from the edit dialog.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
