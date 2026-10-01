import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Persistent Left Sidebar */}
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} />

      {/* Main Content Wrapper - responds to sidebar width */}
      <div className="flex-1 flex flex-col md:ml-[80px] lg:ml-[245px] transition-all duration-300 w-full">
        {/* Sticky Topbar */}
        <Topbar toggleSidebar={toggleSidebar} />

        {/* Scrolling Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 custom-scrollbar relative">
          <div className="mx-auto max-w-7xl">
            {/* The routed content will be injected here */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
