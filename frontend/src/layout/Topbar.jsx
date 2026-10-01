import React from 'react'
import { useTranslation } from 'react-i18next'

const Topbar = ({ toggleSidebar }) => {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm">
      {/* Mobile Hamburger Menu */}
      <button
        className="md:hidden mr-3 p-2 rounded-md text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={toggleSidebar}
      >
        <span className="sr-only">Open sidebar</span>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h16"
          ></path>
        </svg>
      </button>

      {/* Global Search Input */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-slate-50/80 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
            placeholder={t('common.search', 'Search across platform...')}
          />
        </div>
      </div>

      {/* Right Side Header Items */}
      <div className="ml-4 flex items-center space-x-2 md:space-x-4">
        {/* Notification Bell */}
        <button className="p-2 rounded-full text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
          <span className="sr-only">View notifications</span>
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>

        {/* User Profile Avatar */}
        <div className="relative">
          <button className="flex text-sm border-2 border-transparent rounded-full focus:outline-none focus:border-blue-500 transition-all">
            <img
              className="h-8 w-8 md:h-9 md:w-9 rounded-full object-cover border border-slate-200 shadow-sm"
              src="https://ui-avatars.com/api/?name=Super+Admin&background=eff6ff&color=2563eb"
              alt="User Avatar"
            />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Topbar
