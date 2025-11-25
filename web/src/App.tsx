import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from './components/ui/toaster'

// Layouts
import DashboardLayout from './layouts/DashboardLayout'
import AuthLayout from './layouts/AuthLayout'

// Auth Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Dashboard Pages
import DashboardHome from './pages/dashboard/DashboardHome'
import LeadsPage from './pages/leads/LeadsPage'
import LeadDetailPage from './pages/leads/LeadDetailPage'
import ProposalsPage from './pages/proposals/ProposalsPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import TasksPage from './pages/tasks/TasksPage'
import SchedulePage from './pages/schedule/SchedulePage'
import BudgetPage from './pages/budget/BudgetPage'
import InvoicesPage from './pages/invoices/InvoicesPage'
import MaterialsPage from './pages/materials/MaterialsPage'
import SelectionsPage from './pages/selections/SelectionsPage'
import DailyLogsPage from './pages/dailyLogs/DailyLogsPage'
import DocumentsPage from './pages/documents/DocumentsPage'
import SoldPage from './pages/sold/SoldPage'
import InspectionsPage from './pages/inspections/InspectionsPage'
import BidsPage from './pages/bids/BidsPage'
import EquipmentPage from './pages/equipment/EquipmentPage'
import MessagesPage from './pages/messages/MessagesPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import SettingsPage from './pages/settings/SettingsPage'
import UsersPage from './pages/users/UsersPage'

// Client Portal
import ClientPortalPage from './pages/client/ClientPortalPage'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth checks are disabled for now; allow all routes through
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Dashboard Routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardHome />} />
            <Route path="/dashboard" element={<DashboardHome />} />

            {/* Leads & Sales */}
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/proposals" element={<ProposalsPage />} />

            {/* Projects */}
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />

            {/* Tasks & Scheduling */}
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/schedule" element={<SchedulePage />} />

            {/* Financial */}
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/bids" element={<BidsPage />} />
            <Route path="/sold" element={<SoldPage />} />

            {/* Materials & Selections */}
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/selections" element={<SelectionsPage />} />

            {/* Field Operations */}
            <Route path="/daily-logs" element={<DailyLogsPage />} />
            <Route path="/inspections" element={<InspectionsPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />

            {/* Documents & Communication */}
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/messages" element={<MessagesPage />} />

            {/* Analytics & Reporting */}
            <Route path="/analytics" element={<AnalyticsPage />} />

            {/* Admin */}
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Client Portal */}
            <Route path="/client-portal" element={<ClientPortalPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
