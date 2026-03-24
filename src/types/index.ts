// User & Auth Types
export type UserRole = 'admin' | 'regional_manager' | 'team_leader' | 'field_officer';

// Phone Source Companies
export type PhoneSource = 'watu' | 'mogo' | 'onfon';

export interface User {
  id: string;
  foCode?: string; // Unique FO identifier like FO-001
  name: string;
  email: string;
  password?: string; // For demo login
  role: UserRole;
  region?: string;
  regionalManagerId?: string; // For team leaders - which regional manager they report to
  teamLeaderId?: string; // For FOs - which team leader they report to
  phone?: string;
  isActive?: boolean; // User active status
  createdAt: Date;
}

// Permissions System
export interface RolePermissions {
  // Sales & Revenue
  viewAllSales: boolean;
  viewRegionSales: boolean;
  viewTeamSales: boolean;
  viewOwnSales: boolean;
  createSale: boolean;
  deleteSale: boolean;
  // Inventory
  viewInventory: boolean;
  registerIMEI: boolean;
  modifyIMEI: boolean;
  deleteIMEI: boolean;
  // Users
  viewAllUsers: boolean;
  viewRegionUsers: boolean;
  viewTeamUsers: boolean;
  createUser: boolean;
  editUser: boolean;
  deleteUser: boolean;
  // Commissions
  viewAllCommissions: boolean;
  viewTeamCommissions: boolean;
  viewOwnCommissions: boolean;
  configureCommissions: boolean;
  approvePayouts: boolean;
  // Reports
  viewReports: boolean;
  exportReports: boolean;
  viewReconciliation: boolean;
  // System
  viewActivityLog: boolean;
  manageProducts: boolean;
  managePrices: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    viewAllSales: true, viewRegionSales: true, viewTeamSales: true, viewOwnSales: true, createSale: true, deleteSale: true,
    viewInventory: true, registerIMEI: true, modifyIMEI: true, deleteIMEI: true,
    viewAllUsers: true, viewRegionUsers: true, viewTeamUsers: true, createUser: true, editUser: true, deleteUser: true,
    viewAllCommissions: true, viewTeamCommissions: true, viewOwnCommissions: true, configureCommissions: true, approvePayouts: true,
    viewReports: true, exportReports: true, viewReconciliation: true,
    viewActivityLog: true, manageProducts: true, managePrices: true,
  },
  regional_manager: {
    viewAllSales: false, viewRegionSales: true, viewTeamSales: true, viewOwnSales: true, createSale: false, deleteSale: false,
    viewInventory: true, registerIMEI: false, modifyIMEI: false, deleteIMEI: false,
    viewAllUsers: false, viewRegionUsers: true, viewTeamUsers: true, createUser: false, editUser: false, deleteUser: false,
    viewAllCommissions: false, viewTeamCommissions: true, viewOwnCommissions: true, configureCommissions: false, approvePayouts: false,
    viewReports: true, exportReports: true, viewReconciliation: true,
    viewActivityLog: false, manageProducts: false, managePrices: false,
  },
  team_leader: {
    viewAllSales: false, viewRegionSales: false, viewTeamSales: true, viewOwnSales: true, createSale: false, deleteSale: false,
    viewInventory: true, registerIMEI: false, modifyIMEI: false, deleteIMEI: false,
    viewAllUsers: false, viewRegionUsers: false, viewTeamUsers: true, createUser: false, editUser: false, deleteUser: false,
    viewAllCommissions: false, viewTeamCommissions: true, viewOwnCommissions: true, configureCommissions: false, approvePayouts: false,
    viewReports: true, exportReports: true, viewReconciliation: false,
    viewActivityLog: false, manageProducts: false, managePrices: false,
  },
  field_officer: {
    viewAllSales: false, viewRegionSales: false, viewTeamSales: false, viewOwnSales: true, createSale: true, deleteSale: false,
    viewInventory: true, registerIMEI: false, modifyIMEI: false, deleteIMEI: false,
    viewAllUsers: false, viewRegionUsers: false, viewTeamUsers: false, createUser: false, editUser: false, deleteUser: false,
    viewAllCommissions: false, viewTeamCommissions: false, viewOwnCommissions: true, configureCommissions: false, approvePayouts: false,
    viewReports: false, exportReports: false, viewReconciliation: false,
    viewActivityLog: false, manageProducts: false, managePrices: false,
  },
};

// Activity Log Types
export type ActivityType = 'sale' | 'inventory' | 'user' | 'commission' | 'product' | 'system' | 'allocation';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  action: string;
  description: string;
  userId: string;
  userName: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'sale' | 'commission' | 'inventory' | 'system' | 'allocation';
  userId?: string; // Target user for the notification
  read: boolean;
  createdAt: Date;
}

// Commission Configuration for Products
export interface CommissionConfig {
  foCommission: number; // Commission for Field Officer
  teamLeaderCommission: number; // Commission for Team Leader (Manager)
  regionalManagerCommission: number; // Commission for Regional Manager
}

// Product Types
export type ProductCategory = 'Smartphones' | 'Feature Phones' | 'Tablets' | 'Accessories' | 'SIM Cards' | 'Airtime';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stockQuantity: number;
  // Commission configuration (for phones)
  commissionConfig?: CommissionConfig;
  createdAt: Date;
}

// IMEI Types
export type IMEIStatus = 'IN_STOCK' | 'ALLOCATED' | 'SOLD' | 'LOCKED' | 'LOST';

export interface IMEI {
  id: string;
  imei: string;
  productId: string;
  productName: string;
  capacity?: string;
  status: IMEIStatus;
  sellingPrice: number;
  commission: number; // Total commission pool (legacy, for display)
  commissionConfig?: CommissionConfig; // Per-IMEI commission settings
  source: PhoneSource; // Watu, Mogo, or Onfon
  registeredAt: Date;
  soldAt?: Date;
  soldBy?: string;
  saleId?: string;
  // Stock allocation tracking
  currentOwnerId?: string; // Current owner of this IMEI
  currentOwnerRole?: UserRole;
  allocatedAt?: Date;
  allocatedToRegionalManagerId?: string;
  allocatedToTeamLeaderId?: string;
  allocatedToFOId?: string;
}

// Sale Types
export type PaymentMethod = 'cash' | 'mpesa';

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  imei?: string;
  quantity: number;
  saleAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  etrReceiptNo?: string;
  etrSerial?: string;
  vatAmount: number;
  foCode?: string;
  foName?: string;
  foId?: string; // FO who made the sale
  teamLeaderId?: string; // Team leader in the chain
  regionalManagerId?: string; // Regional manager in the chain
  sellerName?: string;
  sellerEmail?: string;
  source?: PhoneSource; // Company the phone was sold from
  saleType?: 'NORMAL' | 'EXPRESS'; // Type of sale
  assignedRmId?: string; // For express sales
  assignedTlId?: string; // For express sales
  assignedFoId?: string; // For express sales
  soldByAdmin?: boolean; // For express sales
  processedBy?: string; // Admin who processed the express sale
  // Client details
  clientName?: string;
  clientPhone?: string;
  clientIdNumber?: string;
  createdBy: string;
  createdAt: Date;
}

// Commission Types
export type CommissionStatus = 'pending' | 'paid' | 'reversed';
export type CommissionRole = 'field_officer' | 'team_leader' | 'regional_manager';

export interface Commission {
  id: string;
  saleId: string;
  userId: string; // User receiving the commission
  userName: string;
  role: CommissionRole; // Role that earned this commission
  productId: string;
  productName: string;
  imei?: string;
  amount: number;
  status: CommissionStatus;
  paidAt?: Date;
  reversedAt?: Date;
  reversedReason?: string;
  createdAt: Date;
  region?: string; // Region of the user receiving the commission
  // Legacy fields for backward compatibility
  foId?: string;
  foName?: string;
}

// Stock Allocation Types
export type AllocationStatus = 'pending' | 'completed' | 'reversed';
export type AllocationLevel = 'admin' | 'regional_manager' | 'team_leader' | 'field_officer';

export interface StockAllocation {
  id?: string;
  _id?: string;
  productId: string | Product;
  productName?: string;
  imei?: string; // For phone allocations
  quantity?: number; // For accessory allocations
  fromUserId: string | User;
  fromUserName?: string;
  fromRole?: UserRole;
  fromLevel?: AllocationLevel;
  toUserId: string | User;
  toUserName?: string;
  toRole?: UserRole;
  toLevel?: AllocationLevel;
  level?: AllocationLevel;
  status: AllocationStatus;
  createdAt: Date | string;
  completedAt?: Date | string;
  reversedAt?: Date | string;
  reversedBy?: string;
  notes?: string;
}

export interface UserStockBalance {
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  lastUpdated: Date;
}

// Dashboard Stats
export interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalSales: number;
  todaySales: number;
  totalPhones: number;
  phonesInStock: number;
  phonesSold: number;
  pendingCommissions: number;
}

// Chart Data
export interface ChartDataPoint {
  name: string;
  value: number;
  secondaryValue?: number;
}
