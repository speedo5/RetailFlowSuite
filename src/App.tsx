import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import Dashboard from "./pages/Dashboard";
import { LoginPage } from "./pages/LoginPage";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Commissions from "./pages/Commissions";
import Reconciliation from "./pages/Reconciliation";
import UsersPage from "./pages/UsersPage";
import Reports from "./pages/Reports";
import Receipts from "./pages/Receipts";
import Regions from "./pages/Regions";

import ActivityLog from "./pages/ActivityLog";
import FODashboard from "./pages/FODashboard";
import FOPortal from "./pages/FOPortal";
import FOSalesHistory from "./pages/FOSalesHistory";
import FOCommissions from "./pages/FOCommissions";
import RegionalDashboard from "./pages/RegionalDashboard";
import TeamLeaderDashboard from "./pages/TeamLeaderDashboard";
import TeamLeaderCommissions from "./pages/TeamLeaderCommissions";
import TeamLeaderPOS from "./pages/TeamLeaderPOS";
import StockAllocation from "./pages/StockAllocation";
import ManageFOs from "./pages/ManageFOs";
import AllocationAudit from "./pages/AllocationAudit";
import Profile from "./pages/Profile";
import { MainLayout } from "./components/layout/MainLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/products" element={<Products />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/regions" element={<Regions />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            {/* Stock Allocation Routes */}
            <Route path="/stock-allocation" element={<StockAllocation />} />
            <Route path="/allocation-audit" element={<AllocationAudit />} />
            {/* Regional Manager Routes */}
            <Route path="/regional" element={<RegionalDashboard />} />
            <Route path="/manage-fos" element={<ManageFOs />} />
            {/* Team Leader Routes */}
            <Route path="/team-leader" element={<MainLayout><TeamLeaderDashboard /></MainLayout>} />
            <Route path="/team-leader/commissions" element={<MainLayout><TeamLeaderCommissions /></MainLayout>} />
            <Route path="/team-leader/pos" element={<MainLayout><TeamLeaderPOS /></MainLayout>} />
            {/* FO Routes */}
            <Route path="/fo" element={<MainLayout><FODashboard /></MainLayout>} />
            <Route path="/fo/submit-sale" element={<MainLayout><FOPortal /></MainLayout>} />
            <Route path="/fo/commissions" element={<MainLayout><FOCommissions /></MainLayout>} />
            <Route path="/fo/sales-history" element={<MainLayout><FOSalesHistory /></MainLayout>} />
            <Route path="/fo/my-stock" element={<StockAllocation />} />
            <Route path="/profile" element={<MainLayout><Profile /></MainLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
