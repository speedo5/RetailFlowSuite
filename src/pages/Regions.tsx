import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Plus, Users, UserCog, User, Edit, Trash2, Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { regionService } from '@/services/regionService';

interface Region {
  _id?: string;
  name: string;
  managerId?: string;
  managerName?: string;
  description?: string;
  isActive?: boolean;
}

interface RegionStats {
  teamLeaders: number;
  fieldOfficers: number;
  totalSales: number;
  totalRevenue: number;
}

interface UserSalesData {
  userId: string;
  userName: string;
  role: string;
  salesCount: number;
  totalRevenue: number;
}

export default function Regions() {
  const { users, setUsers, sales, logActivity } = useApp();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regionStats, setRegionStats] = useState<Record<string, RegionStats>>({});
  const [userSalesData, setUserSalesData] = useState<Record<string, UserSalesData[]>>({});

  // Load regions and stats on mount
  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setIsLoading(true);
      const data = await regionService.getRegions();
      setRegions(data);
      
      // Load stats for each region from server
      const newStats: Record<string, RegionStats> = {};
      const newUserSalesData: Record<string, UserSalesData[]> = {};
      
      for (const region of data) {
        if (region._id) {
          try {
            const statsData = await regionService.getRegionStats(region._id);
            if (statsData?.stats) {
              newStats[region.name] = {
                teamLeaders: statsData.stats.teamLeaders || 0,
                fieldOfficers: statsData.stats.fieldOfficers || 0,
                totalSales: statsData.stats.totalSales || 0,
                totalRevenue: statsData.stats.totalRevenue || 0,
              };
            }
            
            // Load user sales data for this region
            const regionUsers = users.filter(u => u.region === region.name);
            const userSalesBreakdown: UserSalesData[] = [];
            
            // Get sales for Regional Manager
            if (region.managerId) {
              const manager = users.find(u => u.id === region.managerId);
              if (manager) {
                const managerSales = sales.filter(s => s.foId === manager.id || s.createdBy === manager.id);
                userSalesBreakdown.push({
                  userId: manager.id,
                  userName: manager.name,
                  role: 'Regional Manager',
                  salesCount: managerSales.length,
                  totalRevenue: managerSales.reduce((sum, s) => sum + s.saleAmount, 0),
                });
              }
            }
            
            // Get sales for Team Leaders
            const teamLeaders = regionUsers.filter(u => u.role === 'team_leader');
            for (const tl of teamLeaders) {
              const tlSales = sales.filter(s => s.foId === tl.id || s.createdBy === tl.id);
              userSalesBreakdown.push({
                userId: tl.id,
                userName: tl.name,
                role: 'Team Leader',
                salesCount: tlSales.length,
                totalRevenue: tlSales.reduce((sum, s) => sum + s.saleAmount, 0),
              });
            }
            
            // Get sales for Field Officers
            const fieldOfficers = regionUsers.filter(u => u.role === 'field_officer');
            for (const fo of fieldOfficers) {
              const foSales = sales.filter(s => s.foId === fo.id || s.createdBy === fo.id);
              userSalesBreakdown.push({
                userId: fo.id,
                userName: fo.name,
                role: 'Field Officer',
                salesCount: foSales.length,
                totalRevenue: foSales.reduce((sum, s) => sum + s.saleAmount, 0),
              });
            }
            
            newUserSalesData[region.name] = userSalesBreakdown;
          } catch (error) {
            console.error(`Error loading stats for region ${region.name}:`, error);
          }
        }
      }
      setRegionStats(newStats);
      setUserSalesData(newUserSalesData);
    } catch (error) {
      toast.error('Failed to load regions');
      console.error('Error loading regions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate stats when regions, users, or sales change
  useEffect(() => {
    if (regions.length > 0) {
      // Reload stats when regions change
      const reloadStats = async () => {
        const newStats: Record<string, RegionStats> = {};
        const newUserSalesData: Record<string, UserSalesData[]> = {};
        
        for (const region of regions) {
          if (region._id) {
            try {
              const statsData = await regionService.getRegionStats(region._id);
              if (statsData?.stats) {
                newStats[region.name] = {
                  teamLeaders: statsData.stats.teamLeaders || 0,
                  fieldOfficers: statsData.stats.fieldOfficers || 0,
                  totalSales: statsData.stats.totalSales || 0,
                  totalRevenue: statsData.stats.totalRevenue || 0,
                };
              }
              
              // Load user sales data for this region
              const regionUsers = users.filter(u => u.region === region.name);
              const userSalesBreakdown: UserSalesData[] = [];
              
              // Get sales for Regional Manager
              if (region.managerId) {
                const manager = users.find(u => u.id === region.managerId);
                if (manager) {
                  const managerSales = sales.filter(s => s.foId === manager.id || s.createdBy === manager.id);
                  userSalesBreakdown.push({
                    userId: manager.id,
                    userName: manager.name,
                    role: 'Regional Manager',
                    salesCount: managerSales.length,
                    totalRevenue: managerSales.reduce((sum, s) => sum + s.saleAmount, 0),
                  });
                }
              }
              
              // Get sales for Team Leaders
              const teamLeaders = regionUsers.filter(u => u.role === 'team_leader');
              for (const tl of teamLeaders) {
                const tlSales = sales.filter(s => s.foId === tl.id || s.createdBy === tl.id);
                userSalesBreakdown.push({
                  userId: tl.id,
                  userName: tl.name,
                  role: 'Team Leader',
                  salesCount: tlSales.length,
                  totalRevenue: tlSales.reduce((sum, s) => sum + s.saleAmount, 0),
                });
              }
              
              // Get sales for Field Officers
              const fieldOfficers = regionUsers.filter(u => u.role === 'field_officer');
              for (const fo of fieldOfficers) {
                const foSales = sales.filter(s => s.foId === fo.id || s.createdBy === fo.id);
                userSalesBreakdown.push({
                  userId: fo.id,
                  userName: fo.name,
                  role: 'Field Officer',
                  salesCount: foSales.length,
                  totalRevenue: foSales.reduce((sum, s) => sum + s.saleAmount, 0),
                });
              }
              
              newUserSalesData[region.name] = userSalesBreakdown;
            } catch (error) {
              console.error(`Error loading stats for region ${region.name}:`, error);
            }
          }
        }
        setRegionStats(newStats);
        setUserSalesData(newUserSalesData);
      };
      reloadStats();
    }
  }, [regions, users, sales]);

  // Get users without a region or unassigned regional managers
  const unassignedManagers = users.filter(
    u => u.role === 'regional_manager' && !u.region
  );

  const handleAddRegion = async () => {
    if (!newRegionName.trim()) {
      toast.error('Please enter a region name');
      return;
    }

    if (regions.some(r => r.name.toLowerCase() === newRegionName.trim().toLowerCase())) {
      toast.error('Region already exists');
      return;
    }

    try {
      const newRegion = await regionService.createRegion({
        name: newRegionName.trim(),
        managerId: selectedManager || undefined,
      });

      // If a manager is selected, update their region in local state
      if (selectedManager) {
        setUsers(prev => prev.map(u => 
          u.id === selectedManager 
            ? { ...u, region: newRegionName.trim() }
            : u
        ));
      }

      setRegions(prev => [...prev, {
        _id: newRegion._id,
        name: newRegion.name,
        managerId: newRegion.managerId,
        description: newRegion.description,
      }]);

      logActivity('user', 'Region Created', `Created new region: ${newRegionName.trim()}`);
      toast.success(`Region "${newRegionName.trim()}" created successfully`);
      
      setNewRegionName('');
      setSelectedManager('');
      setIsAddDialogOpen(false);
      
      // Reload regions and stats
      await loadRegions();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create region');
      console.error('Error creating region:', error);
    }
  };

  const handleEditRegion = async () => {
    if (!editingRegion || !editingRegion._id) return;
    
    try {
      const updatedRegion = await regionService.updateRegion(editingRegion._id, {
        managerId: selectedManager || undefined,
        description: editingDescription || undefined,
      });

      // Update the regional manager assignment in local state
      setUsers(prev => prev.map(u => {
        // Remove region from old manager
        if (u.role === 'regional_manager' && u.region === editingRegion.name && u.id !== selectedManager) {
          return { ...u, region: undefined };
        }
        // Assign region to new manager
        if (u.id === selectedManager) {
          return { ...u, region: editingRegion.name };
        }
        return u;
      }));

      // Update regions with the response from server
      setRegions(prev => prev.map(r => 
        r._id === editingRegion._id
          ? { 
              ...r, 
              managerId: updatedRegion.managerId,
              managerName: updatedRegion.managerName,
              description: updatedRegion.description
            }
          : r
      ));

      logActivity('user', 'Region Updated', `Updated region: ${editingRegion.name}`);
      toast.success(`Region "${editingRegion.name}" updated successfully`);
      
      setEditingRegion(null);
      setSelectedManager('');
      setEditingDescription('');
      setIsEditDialogOpen(false);
      
      // Reload regions and stats
      await loadRegions();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update region');
      console.error('Error updating region:', error);
    }
  };

  const handleDeleteRegion = async (region: Region) => {
    const regionUsers = users.filter(u => u.region === region.name);
    
    if (regionUsers.length > 0) {
      toast.error(`Cannot delete region with ${regionUsers.length} assigned users. Reassign users first.`);
      return;
    }

    try {
      if (!region._id) {
        toast.error('Region ID not found');
        return;
      }

      await regionService.deleteRegion(region._id);
      setRegions(prev => prev.filter(r => r._id !== region._id));
      logActivity('user', 'Region Deleted', `Deleted region: ${region.name}`);
      toast.success(`Region "${region.name}" deleted successfully`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete region');
      console.error('Error deleting region:', error);
    }
  };

  const openEditDialog = (region: Region) => {
    setEditingRegion(region);
    setSelectedManager(region.managerId || '');
    setEditingDescription(region.description || '');
    setIsEditDialogOpen(true);
  };

  // Get all regional managers for assignment
  const allRegionalManagers = users.filter(u => u.role === 'regional_manager');

  // Get manager name from users or from populated manager object
  const getManagerName = (managerId?: string | any) => {
    if (!managerId) return undefined;
    // Handle populated manager object from API response
    if (typeof managerId === 'object' && managerId.name) {
      return managerId.name;
    }
    // Handle string ID lookup from users array
    return users.find(u => u.id === managerId)?.name;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading regions...</p>
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
            <h1 className="text-2xl font-heading font-bold text-foreground">Regions</h1>
            <p className="text-muted-foreground">Manage regional structure and assignments</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Region
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Region</DialogTitle>
                <DialogDescription>
                  Create a new region and optionally assign a regional manager.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="regionName">Region Name</Label>
                  <Input
                    id="regionName"
                    placeholder="e.g., Rift Valley"
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Regional Manager (Optional)</Label>
                  <Select value={selectedManager || "none"} onValueChange={(val) => setSelectedManager(val === "none" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a regional manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager assigned</SelectItem>
                      {unassignedManagers.map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRegion}>Create Region</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{regions.length}</p>
                <p className="text-sm text-muted-foreground">Total Regions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'regional_manager').length}
                </p>
                <p className="text-sm text-muted-foreground">Regional Managers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserCog className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'team_leader').length}
                </p>
                <p className="text-sm text-muted-foreground">Team Leaders</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <User className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'field_officer').length}
                </p>
                <p className="text-sm text-muted-foreground">Field Officers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Regions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {regions.map((region) => {
            const stats = regionStats[region.name];
            const managerName = getManagerName(region.managerId);
            return (
              <Card key={region._id || region.name} className="border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{region.name}</CardTitle>
                      {managerName ? (
                        <p className="text-sm text-muted-foreground">
                          Manager: {managerName}
                        </p>
                      ) : (
                        <p className="text-sm text-warning">No manager assigned</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(region)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRegion(region)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <UserCog className="h-4 w-4 text-primary" />
                        <span className="text-2xl font-bold">{stats?.teamLeaders || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Team Leaders</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <User className="h-4 w-4 text-success" />
                        <span className="text-2xl font-bold">{stats?.fieldOfficers || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Field Officers</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-2xl font-bold">{stats?.totalSales || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Total Sales</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-2xl font-bold text-success">
                          Ksh {((stats?.totalRevenue || 0) / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>

                  {/* Team Structure */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Team Structure</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {users
                        .filter(u => u.role === 'team_leader' && u.region === region.name)
                        .map(tl => {
                          const foCount = users.filter(
                            u => u.role === 'field_officer' && u.teamLeaderId === tl.id
                          ).length;
                          return (
                            <div
                              key={tl.id}
                              className="flex items-center justify-between p-2 rounded bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-primary" />
                                <span className="text-sm">{tl.name}</span>
                              </div>
                              <Badge variant="secondary">{foCount} FOs</Badge>
                            </div>
                          );
                        })}
                      {users.filter(u => u.role === 'team_leader' && u.region === region.name)
                        .length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No team leaders assigned
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Edit Region Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Region: {editingRegion?.name}</DialogTitle>
              <DialogDescription>
                Update the regional manager assignment and description.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Regional Manager</Label>
                <Select value={selectedManager || "none"} onValueChange={(val) => setSelectedManager(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a regional manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager assigned</SelectItem>
                    {allRegionalManagers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} {manager.region && manager.region !== editingRegion?.name ? `(${manager.region})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDescription">Description (Optional)</Label>
                <Input
                  id="editDescription"
                  placeholder="e.g., Central business area"
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditRegion}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regions Table */}
        <Card className="border shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              All Regions Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Regional Manager</TableHead>
                  <TableHead className="text-center">Team Leaders</TableHead>
                  <TableHead className="text-center">Field Officers</TableHead>
                  <TableHead className="text-center">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((region) => {
                  const stats = regionStats[region.name];
                  const managerName = getManagerName(region.managerId);
                  return (
                    <TableRow key={region._id || region.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {region.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {managerName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-warning" />
                            {managerName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{stats?.teamLeaders || 0}</TableCell>
                      <TableCell className="text-center">{stats?.fieldOfficers || 0}</TableCell>
                      <TableCell className="text-center">{stats?.totalSales || 0}</TableCell>
                      <TableCell className="text-right font-medium text-success">
                        Ksh {(stats?.totalRevenue || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
