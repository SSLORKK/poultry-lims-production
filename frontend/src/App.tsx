import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './features/auth/components/LoginPage';
import { RegisterPage } from './features/auth/components/RegisterPage';
import { MainLayout } from './components/MainLayout';
import { UnifiedSampleRegistration } from './features/samples/components/UnifiedSampleRegistration';
import { AllSamplesView } from './features/samples/components/AllSamplesView';
import { PCRSamples } from './features/samples/components/PCRSamples';
import { SerologySamples } from './features/samples/components/SerologySamples';
import { MicrobiologySamples } from './features/samples/components/MicrobiologySamples';
import { MicrobiologyCOA } from './features/samples/components/MicrobiologyCOA';
import { TechnicalDataSheet } from './features/samples/components/TechnicalDataSheet';
import { PCRCOA } from './features/samples/components/PCRCOA';
import PCRCOAPreview from './features/pcr/components/PCRCOAPreview';
import Dashboard from './features/dashboard/components/Dashboard';
import Controls from './features/controls/components/Controls';
import Database from './features/database/components/Database';
import Reports from './features/reports/components/Reports';
import Drive from './features/drive/components/Drive';
import { DriveAdmin } from './features/drive/components/DriveAdmin';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SmartRedirect } from './components/SmartRedirect';
import ErrorBoundary from './components/common/ErrorBoundary';

// Optimized React Query configuration for performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // Data stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000,          // Cache persists for 10 minutes
      refetchOnWindowFocus: false,      // Don't refetch on window focus
      refetchOnReconnect: true,         // Refetch on reconnect
      retry: 1,                         // Retry failed requests once
      retryDelay: 1000,                 // Wait 1 second before retry
    },
    mutations: {
      retry: 0,                         // Don't retry mutations
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/pcr-coa/:unitId/preview"
            element={
              <ProtectedRoute>
                <PCRCOAPreview />
              </ProtectedRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SmartRedirect />} />
            <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="all-samples" element={<ErrorBoundary><AllSamplesView /></ErrorBoundary>} />
            <Route path="register-sample" element={<ErrorBoundary><UnifiedSampleRegistration /></ErrorBoundary>} />
            <Route path="pcr/samples" element={<ErrorBoundary><PCRSamples /></ErrorBoundary>} />
            <Route path="pcr-coa/:unitId" element={<ErrorBoundary><PCRCOA /></ErrorBoundary>} />
            <Route path="serology/samples" element={<ErrorBoundary><SerologySamples /></ErrorBoundary>} />
            <Route path="microbiology/samples" element={<ErrorBoundary><MicrobiologySamples /></ErrorBoundary>} />
            <Route path="microbiology/technical-data-sheet" element={<ErrorBoundary><TechnicalDataSheet /></ErrorBoundary>} />
            <Route path="microbiology-coa/:unitId" element={<ErrorBoundary><MicrobiologyCOA /></ErrorBoundary>} />
            <Route path="database" element={<ErrorBoundary><Database /></ErrorBoundary>} />
            <Route path="drive" element={<ErrorBoundary><Drive /></ErrorBoundary>} />
            <Route path="drive-admin" element={<ErrorBoundary><DriveAdmin /></ErrorBoundary>} />
            <Route path="controls" element={<ErrorBoundary><Controls /></ErrorBoundary>} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
