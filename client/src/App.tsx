// Routes: "/" landing, "/:slug/*" storefront, "/admin/*" admin portal. Every page is lazy-loaded.
import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { ScrollToTop } from "@/components/layout/ScrollToTop"
import { PageLoader } from "@/components/shared/PageLoader"

const LandingPage = lazy(() => import("@/pages/LandingPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

// Storefront
const StoreLayout = lazy(() => import("@/components/store/StoreLayout"))
const HomePage = lazy(() => import("@/pages/store/HomePage"))
const MenuPage = lazy(() => import("@/pages/store/MenuPage"))
const ItemPage = lazy(() => import("@/pages/store/ItemPage"))
const AccountPage = lazy(() => import("@/pages/store/AccountPage"))
const OrdersPage = lazy(() => import("@/pages/store/OrdersPage"))
const LegalPage = lazy(() => import("@/pages/store/LegalPage"))
const OrderDetailPage = lazy(() => import("@/pages/store/OrderDetailPage"))
const CheckoutReturnPage = lazy(() => import("@/pages/store/CheckoutReturnPage"))
const FaqPage = lazy(() => import("@/pages/store/FaqPage"))
const AboutPage = lazy(() => import("@/pages/store/AboutPage"))
const ContactPage = lazy(() => import("@/pages/store/ContactPage"))

const TeamPage = lazy(() => import("@/pages/TeamPage"))

// Rider portal
const RiderLoginPage = lazy(() => import("@/pages/rider/RiderLoginPage"))
const StaffLoginPage = lazy(() => import("@/pages/staff/StaffLoginPage"))
const RiderDeliveredPage = lazy(() => import("@/pages/rider/DeliveredPage"))

// Admin
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"))
const LoginPage = lazy(() => import("@/pages/admin/auth/LoginPage"))
const RegisterPage = lazy(() => import("@/pages/admin/auth/RegisterPage"))
const ForgotPasswordPage = lazy(() => import("@/pages/admin/auth/ForgotPasswordPage"))
const AcceptInvitePage = lazy(() => import("@/pages/admin/auth/AcceptInvitePage"))
const AdminHome = lazy(() => import("@/pages/admin/AdminHome"))
const LiveOrdersPage = lazy(() => import("@/pages/admin/LiveOrdersPage"))
const AdminOrdersPage = lazy(() => import("@/pages/admin/OrdersPage"))
const AdminOrderDetailPage = lazy(() => import("@/pages/admin/OrderDetailPage"))
const DeliveriesPage = lazy(() => import("@/pages/admin/DeliveriesPage"))
const PaymentsPage = lazy(() => import("@/pages/admin/PaymentsPage"))
const ChatPage = lazy(() => import("@/pages/admin/ChatPage"))
const MenusPage = lazy(() => import("@/pages/admin/MenusPage"))
const OptionGroupsPage = lazy(() => import("@/pages/admin/OptionGroupsPage"))
const AvailabilityPage = lazy(() => import("@/pages/admin/AvailabilityPage"))
const BranchesPage = lazy(() => import("@/pages/admin/BranchesPage"))
const BranchDetailPage = lazy(() => import("@/pages/admin/BranchDetailPage"))
const PromosPage = lazy(() => import("@/pages/admin/PromosPage"))
const CustomersPage = lazy(() => import("@/pages/admin/CustomersPage"))
const ReportsPage = lazy(() => import("@/pages/admin/ReportsPage"))
const AnalyticsPage = lazy(() => import("@/pages/admin/AnalyticsPage"))
const FinancePage = lazy(() => import("@/pages/admin/FinancePage"))
const StaffPage = lazy(() => import("@/pages/admin/StaffPage"))
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"))
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"))
const PlatformPage = lazy(() => import("@/pages/admin/PlatformPage"))
const EmailLogPage = lazy(() => import("@/pages/admin/EmailLogPage"))
const MyAccountPage = lazy(() => import("@/pages/admin/MyAccountPage"))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* The one public "Team login" link lands here, where people pick their door */}
          <Route path="/team" element={<TeamPage />} />

          {/* Staff sign-in (kitchen and branch staff): lands on the live board inside the admin portal */}
          <Route path="/staff/login" element={<StaffLoginPage />} />

          {/* Rider portal: its own sign-in and a small shell, so riders never need the admin screens */}
          <Route path="/rider/login" element={<RiderLoginPage />} />
          <Route path="/rider" element={<ProtectedRoute loginPath="/rider/login" anyOf={["orders.deliver"]} />}>
            <Route element={<AdminLayout portal="rider" />}>
              <Route index element={<DeliveriesPage inPortal />} />
              <Route path="done" element={<RiderDeliveredPage />} />
              <Route path="account" element={<MyAccountPage />} />
              <Route path="*" element={<Navigate to="/rider" replace />} />
            </Route>
          </Route>

          {/* Admin portal */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/register" element={<RegisterPage />} />
          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="me" element={<MyAccountPage />} />
              <Route element={<ProtectedRoute anyOf={["orders.view"]} />}>
                <Route path="live" element={<LiveOrdersPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="orders/:id" element={<AdminOrderDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute anyOf={["orders.deliver"]} />}><Route path="deliveries" element={<DeliveriesPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["payments.view"]} />}><Route path="payments" element={<PaymentsPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["chat.view"]} />}><Route path="chat" element={<ChatPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["menu.view"]} />}>
                <Route path="menus" element={<MenusPage />} />
                <Route path="option-groups" element={<OptionGroupsPage />} />
              </Route>
              <Route element={<ProtectedRoute anyOf={["availability.view"]} />}><Route path="availability" element={<AvailabilityPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["branches.view"]} />}>
                <Route path="branches" element={<BranchesPage />} />
                <Route path="branches/:id" element={<BranchDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute anyOf={["promos.view"]} />}><Route path="promos" element={<PromosPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["customers.view"]} />}><Route path="customers" element={<CustomersPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["reports.view"]} />}><Route path="reports" element={<ReportsPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["finance.view"]} />}>
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="finance" element={<FinancePage />} />
              </Route>
              <Route element={<ProtectedRoute anyOf={["staff.view"]} />}><Route path="staff" element={<StaffPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["settings.view"]} />}><Route path="settings" element={<SettingsPage />} /></Route>
              <Route element={<ProtectedRoute anyOf={["audit.view"]} />}><Route path="audit" element={<AuditLogPage />} /></Route>
              <Route element={<ProtectedRoute platform />}>
                <Route path="platform" element={<PlatformPage />} />
                <Route path="email-log" element={<EmailLogPage />} />
              </Route>
            </Route>
          </Route>

          {/* Storefront */}
          <Route path="/:slug" element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="item/:itemId" element={<ItemPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="checkout/return" element={<CheckoutReturnPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy-policy" element={<LegalPage doc="privacy-policy" />} />
            <Route path="delivery-policy" element={<LegalPage doc="delivery-policy" />} />
            <Route path="terms" element={<LegalPage doc="terms" />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
