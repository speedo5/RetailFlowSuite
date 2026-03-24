import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, ArrowRightLeft, Package, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/types';
import { userService } from '@/services/userService';
import * as stockAllocationService from '@/services/stockAllocationService';

export default function ManageFOs() {
  const { currentUser, users, setUsers, imeis, sales, commissions, logActivity } = useApp();
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedFO, setSelectedFO] = useState<User | null>(null);
  const [newTeamLeaderId, setNewTeamLeaderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiTeamLeaders, setApiTeamLeaders] = useState<User[]>([]);
  const [apiFieldOfficers, setApiFieldOfficers] = useState<User[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [assignTargetTL, setAssignTargetTL] = useState<User | null>(null);
  const [selectedFOIdsForAssign, setSelectedFOIdsForAssign] = useState<string[]>([]);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const prevUserIdsRef = React.useRef<Set<string>>(new Set());

  // Load team leaders and field officers from API on mount
  useEffect(() => {
    const loadTeamData = async () => {
      if (!currentUser || currentUser.role !== 'regional_manager') {
        setPageLoading(false);
        return;
      }

      const parseUsersResponse = (res: any) => {
        if (!res) return [];
        let users: any[] = [];
        if (Array.isArray(res)) users = res;
        else if (res.data && Array.isArray(res.data.users)) users = res.data.users;
        else if (res.data && Array.isArray(res.data)) users = res.data;
        else if (res.users && Array.isArray(res.users)) users = res.users;
        
        // Normalize field names (_id to id, team_leader_id to teamLeaderId)
        return users.map(u => {
          // Handle both cases: teamLeaderId as object (populated) or as string (ID)
          const tlId = typeof u.teamLeaderId === 'object' 
            ? u.teamLeaderId?._id || u.teamLeaderId?.id
            : (u.teamLeaderId || u.team_leader_id);
            
          return {
            ...u,
            id: u.id || u._id,
            teamLeaderId: tlId // Ensure we extract the ID if it's a populated object
          };
        });
      };

      try {
        setPageLoading(true);
        console.log('📥 Loading team data for region:', currentUser.region, 'RM ID:', currentUser.id);

        // Fetch team leaders and FOs (API may return different shapes)
        const tlRaw = await userService.getAll({ role: 'team_leader', region: currentUser.region });
        const foRaw = await userService.getAll({ role: 'field_officer', region: currentUser.region });

        let teamLeaders = parseUsersResponse(tlRaw);
        let fieldOfficers = parseUsersResponse(foRaw);

        console.log('📊 Parsed Team Leaders:', teamLeaders.length, 'records');
        console.log('📊 Parsed Field Officers:', fieldOfficers.length, 'records');
        
        // Debug: Log the first FO to check if teamLeaderId is being properly set
        if (fieldOfficers.length > 0) {
          console.log('🔍 First FO data:', fieldOfficers[0]);
          console.log('🔍 First FO teamLeaderId:', fieldOfficers[0].teamLeaderId);
        }

        // Fallback: if role-filtered endpoints are empty, fetch all users in region and split by role
        if (teamLeaders.length === 0 && fieldOfficers.length === 0) {
          try {
            console.log('🔁 Role-filtered endpoints empty — fetching all users for region as fallback');
            const allRaw = await userService.getAll({ region: currentUser.region });
            const allUsers = parseUsersResponse(allRaw);
            teamLeaders = allUsers.filter((u: any) => u.role === 'team_leader');
            fieldOfficers = allUsers.filter((u: any) => u.role === 'field_officer');
            console.log('🔍 Fallback split — TLs:', teamLeaders.length, 'FOs:', fieldOfficers.length);
          } catch (fbErr) {
            console.warn('Fallback fetch failed:', fbErr);
          }
        }

        // Update states
        setApiTeamLeaders(teamLeaders);
        setApiFieldOfficers(fieldOfficers);

        // Merge into global users context for persistence (only if we actually fetched users)
        const allUsers = [...teamLeaders, ...fieldOfficers];
        if (allUsers.length > 0) {
          setUsers(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const existingNonRegional = prevArr.filter(u => u.region !== currentUser.region || (u.role !== 'team_leader' && u.role !== 'field_officer'));
            return [...existingNonRegional, ...allUsers];
          });
        }
      } catch (error: any) {
        console.error('❌ Error loading team data:', error);
        console.error('Error details:', error?.response?.data || error?.message);

        // Try to use context data as fallback
        const contextTeamLeaders = users.filter(u => u.role === 'team_leader' && u.region === currentUser.region);
        const contextFOs = users.filter(u => u.role === 'field_officer' && u.region === currentUser.region);

        if (contextTeamLeaders.length > 0 || contextFOs.length > 0) {
          console.log('📦 Using fallback context data:', contextTeamLeaders.length, 'TLs,', contextFOs.length, 'FOs');
          setApiTeamLeaders(contextTeamLeaders);
          setApiFieldOfficers(contextFOs);
          toast.error('Loaded cached data. Please refresh or contact support if data seems outdated.');
        } else {
          toast.error('Failed to load team members. Please refresh the page.');
        }
      } finally {
        setPageLoading(false);
      }
    };

    loadTeamData();
  }, [currentUser?.id, currentUser?.region]);

  // Auto-assign newly added FOs (when logged in as a Team Leader)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'team_leader') {
      // keep prev set in sync
      prevUserIdsRef.current = new Set((users || []).map(u => u.id));
      return;
    }

    const prevIds = prevUserIdsRef.current || new Set<string>();
    const nowIds = new Set((users || []).map(u => u.id));
    const newUserIds: string[] = [];
    for (const id of nowIds) {
      if (!prevIds.has(id)) newUserIds.push(id);
    }

    // Update prev set immediately to avoid re-processing
    prevUserIdsRef.current = nowIds;

    // Find newly added FOs in same region with no teamLeaderId
    const newlyAddedFOs = users.filter(u => newUserIds.includes(u.id) && u.role === 'field_officer' && u.region === currentUser.region && !u.teamLeaderId);
    if (newlyAddedFOs.length === 0) return;

    const assign = async () => {
      setIsAutoAssigning(true);
      try {
        for (const fo of newlyAddedFOs) {
          if (!fo || !fo.id) {
            console.warn('Auto-assign: skipping FO with missing id', fo);
            continue;
          }
          try {
            const resp = await userService.assignTeamLeader(fo.id, currentUser.id);
            if (resp.success && resp.data) {
              const updated = resp.data as User;
              setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
              setApiFieldOfficers(prev => prev.map(u => u.id === updated.id ? updated : u));
            }
          } catch (err) {
            console.error('Auto-assign FO error', err);
          }
        }
      } finally {
        setIsAutoAssigning(false);
      }
    };

    assign();
  }, [users, currentUser, setUsers]);

  // Get team leaders in my region (use API data if available, otherwise context)
  const myTeamLeaders = useMemo(() => {
    if (!currentUser || (currentUser.role !== 'regional_manager' && currentUser.role !== 'team_leader')) return [];
    
    if (currentUser.role === 'regional_manager') {
      // Use API-loaded data if available, otherwise fall back to context
      return apiTeamLeaders.length > 0 ? apiTeamLeaders : users.filter(u => u.role === 'team_leader' && u.region === currentUser.region);
    }
    
    // Team leader can only manage their own FOs
    return [currentUser];
  }, [currentUser, apiTeamLeaders, users]);

  // Get all FOs I can manage (use API data if available, otherwise context)
  const myFOs = useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'regional_manager') {
      return apiFieldOfficers.length > 0 ? apiFieldOfficers : users.filter(u => u.role === 'field_officer' && u.region === currentUser.region);
    }
    
    if (currentUser.role === 'team_leader') {
      // Show only FOs assigned to this team leader
      const filteredFOs = users.filter(u => u.role === 'field_officer' && u.region === currentUser.region && u.teamLeaderId === currentUser.id);
      // If no FOs in context, try apiFieldOfficers
      if (filteredFOs.length === 0 && apiFieldOfficers.length > 0) {
        return apiFieldOfficers.filter(u => u.teamLeaderId === currentUser.id);
      }
      return filteredFOs;
    }
    
    return [];
  }, [currentUser, apiFieldOfficers, users]);

  // Get FO stats
  const foStats = useMemo(() => {
    return myFOs.map(fo => {
      const foId = fo.id;
      const foStock = imeis.filter(i => i.allocatedToFOId === foId && i.status === 'ALLOCATED');
      const foSales = sales.filter(s => s.createdBy === foId);
      const foCommissions = commissions.filter(c => c.foId === foId);
      
      // Look for team leader in both users array and apiTeamLeaders array
      const teamLeader = users.find(u => u.id === fo.teamLeaderId) || 
                        apiTeamLeaders.find(u => u.id === fo.teamLeaderId);
      
      console.log(`📊 FO ${fo.name} (ID: ${foId}, TeamLeaderID: ${fo.teamLeaderId}) -> TL Name: ${teamLeader?.name || 'Unassigned'}`);
      
      return {
        ...fo,
        id: foId, // Ensure id is always set
        teamLeaderName: teamLeader?.name || 'Unassigned',
        stockCount: foStock.length,
        salesCount: foSales.length,
        totalRevenue: foSales.reduce((sum, s) => sum + s.saleAmount, 0),
        totalCommissions: foCommissions.reduce((sum, c) => sum + c.amount, 0),
      };
    });
  }, [myFOs, imeis, sales, commissions, users, apiTeamLeaders]);

  const handleReassign = (fo: User) => {
    setSelectedFO(fo);
    // Default the new team leader to the first available TL (API-loaded or context)
    const defaultTL = myTeamLeaders.length > 0 ? myTeamLeaders[0] : (apiTeamLeaders.length > 0 ? apiTeamLeaders[0] : null);
    setNewTeamLeaderId(defaultTL?.id || '');
    setReassignDialogOpen(true);
  };

  const confirmReassign = async () => {
    if (!selectedFO || !newTeamLeaderId) {
      toast.error('Please select a team leader');
      return;
    }

    if (!selectedFO.id) {
      console.error('confirmReassign: selectedFO missing id', selectedFO);
      toast.error('Cannot reassign: missing field officer id');
      return;
    }

    setIsLoading(true);
    try {
      // Get the new team leader info for display
      const newTeamLeader = [...myTeamLeaders, ...apiTeamLeaders].find(u => u.id === newTeamLeaderId);

      console.log('📤 Reassigning FO:', selectedFO.name, 'to TL:', newTeamLeader?.name);
      console.log('📤 FO ID:', selectedFO.id, 'TL ID:', newTeamLeaderId);

      // Always make API call to ensure database persistence
      const response = await userService.assignTeamLeader(selectedFO.id, newTeamLeaderId);
      
      console.log('✅ API Response:', response);
      console.log('✅ Response Data:', response?.data);

      if (response.success && response.data) {
        // Update local state with the returned data
        let updatedFO = response.data as User;
        
        // Normalize field names in case API returns different names
        updatedFO = {
          ...updatedFO,
          id: updatedFO.id || (updatedFO as any)._id,
          teamLeaderId: updatedFO.teamLeaderId || (updatedFO as any).team_leader_id
        };
        
        console.log('📝 Updated FO after normalization:', updatedFO);
        console.log('📝 Updated FO teamLeaderId:', updatedFO.teamLeaderId);

        // Update context users
        setUsers(prev => {
          const updated = prev.map(u => 
            u.id === selectedFO.id ? updatedFO : u
          );
          console.log('🔄 Updated global users context');
          return updated;
        });

        // Update local state arrays
        setApiFieldOfficers(prev => {
          const updated = prev.map(u =>
            u.id === selectedFO.id ? updatedFO : u
          );
          console.log('🔄 Updated apiFieldOfficers');
          return updated;
        });

        // Log the activity
        logActivity('user', 'FO Reassigned', 
          `Reassigned ${selectedFO.name} to ${newTeamLeader?.name || 'Unassigned'}'s team`
        );
        
        toast.success(`✅ ${selectedFO.name} has been reassigned to ${newTeamLeader?.name}'s team`);

        // Close dialog and reset state
        setReassignDialogOpen(false);
        setSelectedFO(null);
        setNewTeamLeaderId('');
      } else {
        const errorMsg = (response as any).message || 'Failed to reassign field officer';
        console.error('❌ Reassignment failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error reassigning FO:', error);
      const errorMsg = error?.message || error?.response?.data?.message || 'Failed to reassign field officer. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

    // When bulk assign dialog opens, default the target TL to the first TL available
    // and pre-select all available FOs not already assigned to that TL
    useEffect(() => {
      if (!bulkAssignOpen) return;
      if (assignTargetTL) return;
      const defaultTL = myTeamLeaders.length > 0 ? myTeamLeaders[0] : (apiTeamLeaders.length > 0 ? apiTeamLeaders[0] : null);
      if (defaultTL) {
        setAssignTargetTL(defaultTL);
        const available = users.filter(u => u.role === 'field_officer' && u.region === currentUser?.region && u.teamLeaderId !== defaultTL.id);
        setSelectedFOIdsForAssign(available.map(u => u.id));
      }
    }, [bulkAssignOpen, myTeamLeaders, apiTeamLeaders, assignTargetTL, users, currentUser?.region]);

  if (!currentUser || (currentUser.role !== 'regional_manager' && currentUser.role !== 'team_leader')) {
    return (
      <MainLayout>
        <div className="p-8">Access denied. This page is for Regional Managers and Team Leaders only.</div>
      </MainLayout>
    );
  }

  if (pageLoading && currentUser.role === 'regional_manager') {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Loading team members...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Field Officers</h1>
          <p className="text-muted-foreground">
            View and reassign field officers between team leaders in your region
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Leaders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myTeamLeaders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Field Officers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myFOs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {foStats.reduce((sum, fo) => sum + fo.stockCount, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {foStats.reduce((sum, fo) => sum + fo.salesCount, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Leaders Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Team Leaders Overview</CardTitle>
            <CardDescription>FO distribution across team leaders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTeamLeaders.map(tl => {
                const tlFOs = myFOs.filter(fo => fo.teamLeaderId === tl.id);
                return (
                  <Card key={tl.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{tl.name}</p>
                          <p className="text-sm text-muted-foreground">Team Leader</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Field Officers</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{tlFOs.length}</Badge>
                                  <Button size="sm" variant="ghost" onClick={() => {
                                    setAssignTargetTL(tl);
                                    setSelectedFOIdsForAssign([]);
                                    setBulkAssignOpen(true);
                                  }}>
                                    Assign FOs
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    // Preselect all available FOs in region that are not already assigned to this TL
                                    const available = users.filter(u => u.role === 'field_officer' && u.region === currentUser?.region && u.teamLeaderId !== tl.id);
                                    setAssignTargetTL(tl);
                                    setSelectedFOIdsForAssign(available.map(u => u.id));
                                    setBulkAssignOpen(true);
                                  }}>
                                    Assign All
                                  </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Field Officers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Field Officers</CardTitle>
            <CardDescription>All field officers in your region</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>FO Code</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Commissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foStats.map(fo => (
                  <TableRow key={fo.id}>
                    <TableCell className="font-medium">{fo.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{fo.foCode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={fo.teamLeaderName === 'Unassigned' ? 'destructive' : 'default'}>
                        {fo.teamLeaderName}
                      </Badge>
                    </TableCell>
                    <TableCell>{fo.stockCount}</TableCell>
                    <TableCell>{fo.salesCount}</TableCell>
                    <TableCell>KES {fo.totalRevenue.toLocaleString()}</TableCell>
                    <TableCell>KES {fo.totalCommissions.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleReassign(fo)}>
                        <ArrowRightLeft className="h-4 w-4 mr-1" />
                        Reassign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {foStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No field officers in your region
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Reassign Dialog */}
        <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Field Officer</DialogTitle>
              <DialogDescription>
                Move this field officer to a different team leader (one TL can manage multiple FOs)
              </DialogDescription>
            </DialogHeader>
            {selectedFO && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-semibold">{selectedFO.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Currently assigned to: {myTeamLeaders.find(u => u.id === selectedFO.teamLeaderId)?.name || 'Unassigned'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-leader-select">New Team Leader</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select a team leader. One TL can manage multiple FOs.
                  </p>
                  
                  {myTeamLeaders.length === 0 && apiTeamLeaders.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                      <p>No team leaders loaded from API</p>
                      <p className="text-xs mt-1">Region: {currentUser?.region}</p>
                    </div>
                  ) : (
                    <>
                      <Select value={newTeamLeaderId ?? ''} onValueChange={(value) => {
                        if (value === undefined || value === null) {
                          console.warn('onValueChange received invalid value:', value);
                          return;
                        }
                        console.log('🔄 Team leader selected:', value);
                        setNewTeamLeaderId(value);
                      }}>
                        <SelectTrigger id="team-leader-select">
                          <SelectValue placeholder="Select team leader..." />
                        </SelectTrigger>
                        <SelectContent>
                          {myTeamLeaders.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No team leaders available</div>
                          ) : (
                            myTeamLeaders.map(tl => {
                              if (!tl.id) {
                                console.warn('SelectItem: skipping team leader with missing id', tl);
                                return null;
                              }
                              const tlFOCount = myFOs.filter(fo => fo.teamLeaderId === tl.id).length;
                              const isCurrent = tl.id === selectedFO.teamLeaderId;
                              return (
                                <SelectItem key={tl.id} value={tl.id} disabled={isCurrent}>
                                  {tl.name} {isCurrent ? '(current)' : ''} ({tlFOCount} FO{tlFOCount !== 1 ? 's' : ''})
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Preview of assignment */}
                      {newTeamLeaderId && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                          <p className="font-medium text-blue-900">
                            {selectedFO.name} will be assigned to{' '}
                            <span className="font-bold">
                              {myTeamLeaders.find(tl => tl.id === newTeamLeaderId)?.name}
                            </span>
                          </p>
                          <p className="text-xs text-blue-800 mt-1">
                            This TL will then manage{' '}
                            {(myFOs.filter(fo => fo.teamLeaderId === newTeamLeaderId).length + 1)} FO
                            {(myFOs.filter(fo => fo.teamLeaderId === newTeamLeaderId).length + 1) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setReassignDialogOpen(false);
                setSelectedFO(null);
                setNewTeamLeaderId('');
              }} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                onClick={confirmReassign} 
                disabled={!newTeamLeaderId || isLoading}
                className={newTeamLeaderId && !isLoading ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                {isLoading ? 'Reassigning...' : 'Confirm Reassignment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    
        {/* Bulk Assign Dialog */}
        <Dialog open={bulkAssignOpen} onOpenChange={(open) => { if(!open){ setAssignTargetTL(null); setSelectedFOIdsForAssign([]); } setBulkAssignOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Field Officers to Team Leader</DialogTitle>
              <DialogDescription>
                Select one or more field officers to assign to the selected team leader.
              </DialogDescription>
            </DialogHeader>
            {assignTargetTL && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-semibold">{assignTargetTL.name}</p>
                  <p className="text-sm text-muted-foreground">Team Leader</p>
                </div>

                <div className="space-y-2">
                  <Label>Available Field Officers</Label>
                  <div className="max-h-64 overflow-y-auto border rounded p-2">
                    {users.filter(u => u.role === 'field_officer' && u.region === currentUser?.region).map(fo => {
                      const already = fo.teamLeaderId === assignTargetTL.id;
                      return (
                        <div key={fo.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={already}
                              checked={selectedFOIdsForAssign.includes(fo.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedFOIdsForAssign(prev => [...prev, fo.id]);
                                else setSelectedFOIdsForAssign(prev => prev.filter(id => id !== fo.id));
                              }}
                            />
                            <div>
                              <div className="font-medium">{fo.name}</div>
                              <div className="text-xs text-muted-foreground">{fo.foCode || fo.id} {already ? '• already assigned' : ''}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAssignOpen(false)} disabled={isLoading}>Cancel</Button>
              <Button onClick={async () => {
                if (!assignTargetTL || selectedFOIdsForAssign.length === 0) return;
                setIsLoading(true);
                try {
                  // Assign each FO via API and update context
                  for (const foId of selectedFOIdsForAssign) {
                    if (!foId) {
                      console.warn('Bulk assign: skipping invalid FO id', foId);
                      continue;
                    }
                    try {
                      const resp = await userService.assignTeamLeader(foId, assignTargetTL.id);
                      if (resp.success && resp.data) {
                        let updated = resp.data as User;
                        // Normalize field names in case API returns different names
                        updated = {
                          ...updated,
                          id: updated.id || (updated as any)._id,
                          teamLeaderId: updated.teamLeaderId || (updated as any).team_leader_id
                        };
                        setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                        setApiFieldOfficers(prev => prev.map(u => u.id === updated.id ? updated : u));
                        console.log('✅ Bulk assign: Updated FO', updated.name, 'with teamLeaderId:', updated.teamLeaderId);
                      }
                    } catch (err) {
                      console.error('Bulk assign API error for FO id', foId, err);
                    }
                  }
                  toast.success(`Assigned ${selectedFOIdsForAssign.length} FO(s) to ${assignTargetTL.name}`);
                  setBulkAssignOpen(false);
                } catch (err:any) {
                  console.error('Bulk assign error', err);
                  toast.error('Failed to assign some field officers');
                } finally {
                  setIsLoading(false);
                  setSelectedFOIdsForAssign([]);
                  setAssignTargetTL(null);
                }
              }} disabled={isLoading || selectedFOIdsForAssign.length === 0}>
                {isLoading ? 'Assigning...' : `Assign (${selectedFOIdsForAssign.length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
