import { useApp } from '@/context/AppContext';
import { ROLE_PERMISSIONS, RolePermissions, UserRole } from '@/types';

export function usePermissions() {
  const { currentUser } = useApp();
  
  const permissions: RolePermissions = currentUser 
    ? ROLE_PERMISSIONS[currentUser.role] 
    : ROLE_PERMISSIONS.field_officer; // Default to least privilege

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions[permission];
  };

  const isAdmin = currentUser?.role === 'admin';
  const isRegionalManager = currentUser?.role === 'regional_manager';
  const isTeamLeader = currentUser?.role === 'team_leader';
  const isFieldOfficer = currentUser?.role === 'field_officer';

  return {
    permissions,
    hasPermission,
    isAdmin,
    isRegionalManager,
    isTeamLeader,
    isFieldOfficer,
    role: currentUser?.role as UserRole | undefined,
  };
}
