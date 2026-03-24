
import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Shield, Globe, UserCheck, Plus, Phone, Briefcase, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { EditUserDialog } from '@/components/users/EditUserDialog';
import { DeleteUserDialog } from '@/components/users/DeleteUserDialog';
import { User } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { userService } from '@/services/userService';
import { toast } from 'sonner';

export default function UsersPage() {
  const { users, setUsers, currentUser } = useApp();
  const [createSystemUserDialogOpen, setCreateSystemUserDialogOpen] = useState(false);
  const [createFieldOfficerDialogOpen, setCreateFieldOfficerDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await userService.getAll();
      const usersData = Array.isArray(response.data) 
        ? response.data 
        : response.data?.users || [];
      
      setUsers(usersData.map((u: any) => ({
        id: u.id || u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        region: u.region,
        phone: u.phone,
        foCode: u.foCode,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        isActive: u.isActive !== false,
        teamLeaderId: u.teamLeaderId,
        regionalManagerId: u.regionalManagerId,
      })));
    } catch (error: any) {
      toast.error('Failed to load users');
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter active users and separate FOs from system users
  const activeUsers = users.filter(u => u.isActive !== false);
  const fieldOfficers = activeUsers.filter(u => u.role === 'field_officer');
  const systemUsers = activeUsers.filter(u => u.role !== 'field_officer');

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'regional_manager': return Globe;
      case 'team_leader': return Users;
      default: return UserCheck;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'regional_manager': return 'bg-primary text-primary-foreground';
      case 'team_leader': return 'bg-warning text-warning-foreground';
      default: return 'bg-success text-success-foreground';
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Access denied. Admin only.</p>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Manage system users and field officers</p>
          </div>
          <div className="flex gap-2">
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground" 
              onClick={() => setCreateSystemUserDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add System User
            </Button>
            <Button 
              className="bg-success hover:bg-success/90 text-success-foreground" 
              onClick={() => setCreateFieldOfficerDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field Officer
            </Button>
          </div>
        </div>

        <CreateUserDialog 
          open={createSystemUserDialogOpen} 
          onOpenChange={setCreateSystemUserDialogOpen}
          userType="system"
        />
        <CreateUserDialog 
          open={createFieldOfficerDialogOpen} 
          onOpenChange={setCreateFieldOfficerDialogOpen}
          userType="field_officer"
        />
        <EditUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={selectedUser} />
        <DeleteUserDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} user={selectedUser} />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{activeUsers.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-destructive shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{activeUsers.filter(u => u.role === 'admin').length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{activeUsers.filter(u => u.role === 'regional_manager').length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Regional</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{activeUsers.filter(u => u.role === 'team_leader').length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Team Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{fieldOfficers.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Field Officers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for System Users vs Field Officers */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">System Users</span>
              <span className="sm:hidden">System</span>
              <Badge variant="secondary" className="ml-1">{systemUsers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="fo" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Field Officers</span>
              <span className="sm:hidden">FOs</span>
              <Badge variant="secondary" className="ml-1">{fieldOfficers.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* System Users Tab */}
          <TabsContent value="system">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  System Users (Admin, Regional Managers, Team Leaders)
                </CardTitle>
              </CardHeader>
              {/* Mobile Cards */}
              <div className="block lg:hidden p-4 space-y-3">
                {systemUsers.map((user) => {
                  const Icon = getRoleIcon(user.role);
                  return (
                    <Card key={user.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium truncate">{user.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background border shadow-md">
                                  <DropdownMenuItem onClick={() => handleEdit(user)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(user)}
                                    className="text-destructive"
                                    disabled={user.id === currentUser?.id}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge className={getRoleBadgeClass(user.role)}>
                                {user.role.replace('_', ' ')}
                              </Badge>
                              {user.region && (
                                <Badge variant="outline">{user.region}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Region</th>
                      <th>Joined</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.map((user, index) => {
                      const Icon = getRoleIcon(user.role);
                      return (
                        <tr key={user.id}>
                          <td className="text-muted-foreground">{index + 1}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                                <Icon className="h-4 w-4 text-primary-foreground" />
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="text-muted-foreground">{user.email}</td>
                          <td>
                            <Badge className={getRoleBadgeClass(user.role)}>
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td>{user.region || '-'}</td>
                          <td className="text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEdit(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(user)}
                                disabled={user.id === currentUser?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Field Officers Tab */}
          <TabsContent value="fo">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-success" />
                  Field Officers
                </CardTitle>
              </CardHeader>
              {/* Mobile Cards */}
              <div className="block lg:hidden p-4 space-y-3">
                {fieldOfficers.map((fo) => (
                  <Card key={fo.id} className="border border-success/20 bg-success/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center shrink-0">
                          <UserCheck className="h-5 w-5 text-success-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{fo.name}</p>
                                <Badge className="bg-success/20 text-success border-0 text-xs">
                                  {fo.foCode}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{fo.email}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border shadow-md">
                                <DropdownMenuItem onClick={() => handleEdit(fo)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(fo)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {fo.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" /> {fo.phone}
                            </p>
                          )}
                          {fo.region && (
                            <Badge variant="outline" className="mt-2">{fo.region}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {fieldOfficers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No field officers registered yet
                  </div>
                )}
              </div>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>FO Code</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Region</th>
                      <th>Joined</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldOfficers.map((fo, index) => (
                      <tr key={fo.id}>
                        <td className="text-muted-foreground">{index + 1}</td>
                        <td>
                          <Badge className="bg-success/20 text-success border-0">
                            {fo.foCode}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                              <UserCheck className="h-4 w-4 text-success-foreground" />
                            </div>
                            <span className="font-medium">{fo.name}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">{fo.email}</td>
                        <td className="text-muted-foreground">{fo.phone || '-'}</td>
                        <td>{fo.region || '-'}</td>
                        <td className="text-muted-foreground">{new Date(fo.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEdit(fo)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(fo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
