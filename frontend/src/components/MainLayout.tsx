import { Link, Outlet, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ProfileDropdown } from './common/ProfileDropdown';
import { NotificationIcon } from './common/NotificationIcon';
import { useState } from 'react';

export const MainLayout = () => {
  const location = useLocation();
  const { hasAnyPermission, isLoading: permissionsLoading } = usePermissions();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pcr: true,
    serology: true,
    microbiology: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  // Icon components - now responsive to sidebar state
  const DashboardIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );

  const ReportsIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const RegisterIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const SamplesIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );

  const DatabaseIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );

  const DriveIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  const ControlsIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );

  const BeakerIcon = () => (
    <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );

  const DocumentIcon = () => (
    <svg className={`w-4 h-4 flex-shrink-0 ${sidebarOpen ? 'mr-2' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col z-30 transform transition-all duration-300 ease-in-out shadow-2xl ${sidebarOpen ? 'w-72' : 'w-20'
          }`}
      >
        {/* Logo/Header with gradient */}
        <div className={`border-b border-slate-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20 ${sidebarOpen ? 'p-6' : 'p-4 flex justify-center'}`}>
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Poultry LIMS
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Lab Management System</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {permissionsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-500 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-400">Loading menu...</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {/* Dashboard */}
              {hasAnyPermission('Dashboard') && (
                <li>
                  <Link
                    to="/dashboard"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/dashboard'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Dashboard' : undefined}
                  >
                    <DashboardIcon />
                    {sidebarOpen && <span className="font-medium">Dashboard</span>}
                  </Link>
                </li>
              )}

              {/* Reports */}
              {hasAnyPermission('Dashboard') && (
                <li>
                  <Link
                    to="/reports"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/reports'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Reports' : undefined}
                  >
                    <ReportsIcon />
                    {sidebarOpen && <span className="font-medium">Reports</span>}
                  </Link>
                </li>
              )}

              {/* Register Sample */}
              {hasAnyPermission('Register Sample') && (
                <li>
                  <Link
                    to="/register-sample"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/register-sample'
                        ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Register Sample' : undefined}
                  >
                    <RegisterIcon />
                    {sidebarOpen && <span className="font-medium">Register Sample</span>}
                  </Link>
                </li>
              )}

              {/* All Samples */}
              {hasAnyPermission('All Samples') && (
                <li>
                  <Link
                    to="/all-samples"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/all-samples'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'All Samples' : undefined}
                  >
                    <SamplesIcon />
                    {sidebarOpen && <span className="font-medium">All Samples</span>}
                  </Link>
                </li>
              )}

              {/* Database */}
              {(hasAnyPermission('Database - PCR') || hasAnyPermission('Database - Serology') || hasAnyPermission('Database - Microbiology')) && (
                <li>
                  <Link
                    to="/database"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/database'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Database' : undefined}
                  >
                    <DatabaseIcon />
                    {sidebarOpen && <span className="font-medium">Database</span>}
                  </Link>
                </li>
              )}

              {/* Divider */}
              <li className="py-2">
                <div className="border-t border-slate-700/50"></div>
              </li>

              {/* PCR Section */}
              {hasAnyPermission('PCR Samples') && (
                <li>
                  {sidebarOpen ? (
                    <>
                      <button
                        onClick={() => toggleSection('pcr')}
                        className="w-full group flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      >
                        <BeakerIcon />
                        <span className="font-medium flex-1 text-left">PCR</span>
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${expandedSections.pcr ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.pcr && (
                        <ul className="ml-8 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4">
                          <li>
                            <Link
                              to="/pcr/samples"
                              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${location.pathname === '/pcr/samples'
                                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                }`}
                            >
                              <DocumentIcon />
                              PCR Samples
                            </Link>
                          </li>
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      to="/pcr/samples"
                      className={`group flex items-center justify-center px-2 py-3 rounded-xl transition-all duration-200 ${location.pathname === '/pcr/samples'
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }`}
                      title="PCR Samples"
                    >
                      <BeakerIcon />
                    </Link>
                  )}
                </li>
              )}

              {/* Serology Section */}
              {hasAnyPermission('Serology Samples') && (
                <li>
                  {sidebarOpen ? (
                    <>
                      <button
                        onClick={() => toggleSection('serology')}
                        className="w-full group flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      >
                        <BeakerIcon />
                        <span className="font-medium flex-1 text-left">Serology</span>
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${expandedSections.serology ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.serology && (
                        <ul className="ml-8 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4">
                          <li>
                            <Link
                              to="/serology/samples"
                              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${location.pathname === '/serology/samples'
                                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                }`}
                            >
                              <DocumentIcon />
                              Serology Samples
                            </Link>
                          </li>
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      to="/serology/samples"
                      className={`group flex items-center justify-center px-2 py-3 rounded-xl transition-all duration-200 ${location.pathname === '/serology/samples'
                          ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/50'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }`}
                      title="Serology Samples"
                    >
                      <BeakerIcon />
                    </Link>
                  )}
                </li>
              )}

              {/* Microbiology Section */}
              {hasAnyPermission('Microbiology Samples') && (
                <li>
                  {sidebarOpen ? (
                    <>
                      <button
                        onClick={() => toggleSection('microbiology')}
                        className="w-full group flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      >
                        <BeakerIcon />
                        <span className="font-medium flex-1 text-left">Microbiology</span>
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${expandedSections.microbiology ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.microbiology && (
                        <ul className="ml-8 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4">
                          <li>
                            <Link
                              to="/microbiology/samples"
                              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${location.pathname === '/microbiology/samples'
                                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                }`}
                            >
                              <DocumentIcon />
                              Microbiology Samples
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/microbiology/technical-data-sheet"
                              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${location.pathname === '/microbiology/technical-data-sheet'
                                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                }`}
                            >
                              <DocumentIcon />
                              Technical Data Sheet
                            </Link>
                          </li>
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      to="/microbiology/samples"
                      className={`group flex items-center justify-center px-2 py-3 rounded-xl transition-all duration-200 ${location.pathname === '/microbiology/samples'
                          ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/50'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }`}
                      title="Microbiology Samples"
                    >
                      <BeakerIcon />
                    </Link>
                  )}
                </li>
              )}

              {/* Divider */}
              <li className="py-2">
                <div className="border-t border-slate-700/50"></div>
              </li>

              {/* Drive */}
              {hasAnyPermission('Dashboard') && (
                <li>
                  <Link
                    to="/drive"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/drive'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Drive' : undefined}
                  >
                    <DriveIcon />
                    {sidebarOpen && <span className="font-medium">Drive</span>}
                  </Link>
                </li>
              )}

              {/* Controls (at bottom) */}
              {hasAnyPermission('Controls') && (
                <li>
                  <Link
                    to="/controls"
                    className={`group flex items-center ${sidebarOpen ? 'px-4' : 'px-2 justify-center'} py-3 rounded-xl transition-all duration-200 ${location.pathname === '/controls'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/50'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    title={!sidebarOpen ? 'Controls' : undefined}
                  >
                    <ControlsIcon />
                    {sidebarOpen && <span className="font-medium">Controls</span>}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-72' : 'ml-20'
          }`}
      >
        {/* Top Bar with Hamburger Menu */}
        <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 px-6 py-4 flex items-center justify-between relative z-50">
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {location.pathname === '/dashboard' && 'Dashboard'}
                {location.pathname === '/reports' && 'Reports'}
                {location.pathname === '/register-sample' && 'Register Sample'}
                {location.pathname === '/all-samples' && 'All Samples'}
                {location.pathname === '/database' && 'Database'}
                {location.pathname === '/drive' && 'Drive'}
                {location.pathname === '/pcr/samples' && 'PCR Samples'}
                {location.pathname === '/serology/samples' && 'Serology Samples'}
                {location.pathname === '/microbiology/samples' && 'Microbiology Samples'}
                {location.pathname === '/microbiology/technical-data-sheet' && 'Technical Data Sheet'}
                {location.pathname === '/controls' && 'Controls'}
                {location.pathname.includes('/pcr-coa') && 'PCR Certificate of Analysis'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationIcon count={0} />
            {user && !userLoading && <ProfileDropdown user={user} />}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
          <Outlet />
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </div>
  );
};
