import React from 'react'
import { NavLink } from 'react-router-dom'

const navGroups = [
  {
    title: 'Platform',
    links: [
      {
        name: 'Dashboard',
        path: '/admin/dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
      {
        name: 'Communities',
        path: '/super-admin/organizations',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      },
      {
        name: 'Billing & Invoices',
        path: '/billing',
        icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z',
      },
    ],
  },
  {
    title: 'CRM',
    links: [
      {
        name: 'Lead Inquiries',
        path: '/crm/inquiries',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      },
      {
        name: 'Quote Engine',
        path: '/crm/quotes',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        name: 'Active Subscriptions',
        path: '/crm/subscriptions',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      },
    ],
  },
  {
    title: 'System',
    links: [
      {
        name: 'Audit Logs',
        path: '/super-admin/audit-logs',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      },
      {
        name: 'Issue Reports',
        path: '/super-admin/issue-reports',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      },
      {
        name: 'Settings',
        path: '/settings',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      },
    ],
  },
]

const Sidebar = ({ isOpen, closeSidebar }) => {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={closeSidebar}></div>
      )}

      <aside
        className={`fixed left-0 top-0 h-screen bg-slate-50 border-r border-slate-200 w-[245px] md:w-[80px] lg:w-[245px] transition-transform duration-300 z-50 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 bg-white">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
              N
            </div>
            <span className="md:hidden lg:block ml-3 font-bold text-slate-800 text-lg whitespace-nowrap overflow-hidden text-ellipsis">
              Nahom
            </span>
          </div>
          {/* Close button on mobile */}
          <button className="md:hidden text-slate-500 hover:text-slate-800" onClick={closeSidebar}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="md:hidden lg:block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <NavLink
                      to={link.path}
                      onClick={closeSidebar} // close on mobile after navigation
                      className={({ isActive }) =>
                        `relative flex items-center rounded-lg px-3 py-2.5 transition-all duration-300 ease-out group overflow-hidden ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium hover:translate-x-1'
                        } active:scale-[0.98]`
                      }
                      title={link.name}
                    >
                      {({ isActive }) => (
                        <>
                          {/* Animated Left Slide Selection Accent Bar */}
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-600 rounded-r-full transition-all duration-300 ease-out ${
                              isActive
                                ? 'opacity-100 scale-y-100 translate-x-0'
                                : 'opacity-0 scale-y-0 -translate-x-1'
                            }`}
                          />
                          <svg
                            className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                              isActive
                                ? 'text-blue-600 scale-110'
                                : 'text-slate-500 group-hover:scale-105'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d={link.icon}
                            ></path>
                          </svg>
                          <span className="md:hidden lg:block ml-3 truncate transition-colors duration-200">
                            {link.name}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* User Area Bottom */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-center lg:justify-start cursor-pointer group">
            <div className="w-9 h-9 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center text-slate-600 font-semibold">
              SA
            </div>
            <div className="md:hidden lg:block ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                Super Admin
              </p>
              <p className="text-xs text-slate-500 truncate">admin@managemygate.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
