import React, { useEffect } from 'react'
import { useComplaints } from '../hooks/useComplaints'
import ComplaintTopNav from '../components/ComplaintTopNav'
import { useComplaintAnalyticsSocket } from '../hooks/useComplaintAnalyticsSocket'
import { Badge } from 'src/components/ui/badge'
import { Button } from 'src/components/ui/button'
import {
  Ticket,
  MailOpen,
  UserCheck,
  Clock,
  CheckCheck,
  Lock,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Timer,
  TimerOff,
  FileDown,
  Star,
} from 'lucide-react'
import '../styles/_complaints.scss'

const PerformanceAnalytics = () => {
  useComplaintAnalyticsSocket()
  const { dashboardAnalytics: data, loadDashboardAnalytics, isLoading } = useComplaints()

  useEffect(() => {
    loadDashboardAnalytics({})
  }, [])

  const kpis = data?.kpis || {}
  const priorityBreakdown = data?.priorityBreakdown || []
  const categoryBreakdown = data?.categoryBreakdown || []
  const techPerformance = data?.technicianPerformance || []

  const getPriorityCount = (level) =>
    priorityBreakdown.find((p) => p._id === level)?.count || 0
  const getPriorityPercent = (level) => {
    if (!kpis.total) return 0
    return Math.round((getPriorityCount(level) / kpis.total) * 100)
  }

  const StatCard = ({ icon: Icon, value, label, iconBg, iconColor }) => (
    <div className="rounded-xl border border-stroke bg-white p-5 shadow-default transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-strokedark dark:bg-boxdark flex items-center gap-4">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-black dark:text-white">
          {isLoading ? '...' : value}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-0.5">
          {label}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <ComplaintTopNav />
      <div className="mx-auto max-w-screen-2xl p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">
              Performance Analytics
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
              Helpdesk efficiency metrics and feedback
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold px-4 py-2 border-stroke dark:border-strokedark text-black dark:text-white flex items-center gap-1.5"
            onClick={() => {
              const token = localStorage.getItem('token')
              window.open(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5006'}/api/complaints/export?auth_token=${token}`,
                '_blank',
              )
            }}
          >
            <FileDown className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Dashboard Summary */}
        <h3 className="text-sm font-bold text-black dark:text-white mb-4">Dashboard Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard icon={Ticket} value={kpis.total || 0} label="Total Complaints" iconBg="bg-primary/10" iconColor="text-primary" />
          <StatCard icon={MailOpen} value={kpis.open || 0} label="Open Complaints" iconBg="bg-warning/10" iconColor="text-warning" />
          <StatCard icon={UserCheck} value={kpis.assigned || 0} label="Assigned Complaints" iconBg="bg-blue-100 dark:bg-blue-500/20" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard icon={Clock} value={kpis.inProgress || 0} label="In Progress" iconBg="bg-primary/10" iconColor="text-primary" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard icon={CheckCheck} value={kpis.resolved || 0} label="Completed" iconBg="bg-success/10" iconColor="text-success" />
          <StatCard icon={Lock} value={kpis.closed || 0} label="Closed" iconBg="bg-gray-100 dark:bg-gray-500/20" iconColor="text-gray-500" />
          <StatCard icon={TrendingUp} value={kpis.escalated || 0} label="Escalated" iconBg="bg-danger/10" iconColor="text-danger" />
          <StatCard icon={AlertTriangle} value={kpis.critical || 0} label="Critical Complaints" iconBg="bg-danger/10" iconColor="text-danger" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={ShieldCheck} value={kpis.withinSla || 0} label="SLA Met" iconBg="bg-success/10" iconColor="text-success" />
          <StatCard icon={ShieldAlert} value={kpis.slaBreached || 0} label="SLA Breached" iconBg="bg-danger/10" iconColor="text-danger" />
          <StatCard icon={Timer} value={`${Math.round(kpis.averageResponseHours || 0)}h`} label="Avg Response Time" iconBg="bg-blue-100 dark:bg-blue-500/20" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard icon={TimerOff} value={`${Math.round(kpis.averageResolutionHours || 0)}h`} label="Avg Resolution Time" iconBg="bg-primary/10" iconColor="text-primary" />
        </div>

        {/* Priority Summary */}
        <h3 className="text-sm font-bold text-black dark:text-white mb-4">
          Complaint Priority Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { level: 'Critical', color: 'border-s-danger', textColor: 'text-danger' },
            { level: 'High', color: 'border-s-warning', textColor: 'text-warning' },
            { level: 'Medium', color: 'border-s-primary', textColor: 'text-primary' },
            { level: 'Low', color: 'border-s-success', textColor: 'text-success' },
          ].map(({ level, color }) => (
            <div
              key={level}
              className={`rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark border-s-4 ${color}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {level}
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-black dark:text-white">
                  {getPriorityCount(level)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({getPriorityPercent(level)}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Category + SLA Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-10">
          {/* Category Table */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-black dark:text-white mb-4">
              Complaint Category Summary
            </h3>
            <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 dark:bg-meta-4/40 border-b border-stroke dark:border-strokedark">
                    <tr>
                      <th className="py-3 px-5 font-semibold text-black dark:text-white">Category</th>
                      <th className="py-3 px-5 font-semibold text-black dark:text-white">Total</th>
                      <th className="py-3 px-5 font-semibold text-black dark:text-white">Open</th>
                      <th className="py-3 px-5 font-semibold text-black dark:text-white">Resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke dark:divide-strokedark">
                    {categoryBreakdown.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-gray-400 dark:text-gray-500">
                          No categories found
                        </td>
                      </tr>
                    )}
                    {categoryBreakdown.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-meta-4/10">
                        <td className="py-3 px-5 font-bold text-black dark:text-white">
                          {cat._id || 'Others'}
                        </td>
                        <td className="py-3 px-5 text-gray-600 dark:text-gray-300">{cat.count}</td>
                        <td className="py-3 px-5">
                          <Badge variant="lightError" className="text-[10px] px-2 py-0.5 font-bold">
                            {cat.open}
                          </Badge>
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant="lightSuccess" className="text-[10px] px-2 py-0.5 font-bold">
                            {cat.resolved}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SLA Summary */}
          <div>
            <h3 className="text-sm font-bold text-black dark:text-white mb-4">SLA Summary</h3>
            <div className="rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark space-y-4">
              {[
                { label: 'Within SLA', value: kpis.withinSla || 0, color: 'text-success' },
                { label: 'Near SLA Breach', value: kpis.nearSlaBreach || 0, color: 'text-warning' },
                { label: 'Breached', value: kpis.slaBreached || 0, color: 'text-danger' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
              <div className="h-px bg-stroke dark:bg-strokedark" />
              {[
                { label: 'Avg Resolution Time', value: `${Math.round(kpis.averageResolutionHours || 0)} hours` },
                { label: 'Fastest Resolution', value: `${Math.round(kpis.fastestResolutionHours || 0)} hours` },
                { label: 'Slowest Resolution', value: `${Math.round(kpis.slowestResolutionHours || 0)} hours` },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className="text-xs font-bold text-black dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technician Summary */}
        <h3 className="text-sm font-bold text-black dark:text-white mb-4">Technician Summary</h3>
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 dark:bg-meta-4/40 border-b border-stroke dark:border-strokedark">
                <tr>
                  <th className="py-3 px-5 font-semibold text-black dark:text-white">Technician Name</th>
                  <th className="py-3 px-5 font-semibold text-black dark:text-white">Status</th>
                  <th className="py-3 px-5 font-semibold text-black dark:text-white">Pending Assignments</th>
                  <th className="py-3 px-5 font-semibold text-black dark:text-white">Completed Today</th>
                  <th className="py-3 px-5 font-semibold text-black dark:text-white">Avg Resolution Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {techPerformance.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-gray-400 dark:text-gray-500">
                      No technicians active
                    </td>
                  </tr>
                )}
                {techPerformance.map((tech, idx) => {
                  const isBusy = tech.pending > 0
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-meta-4/10">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                            {tech._id.name?.charAt(0) || 'T'}
                          </div>
                          <span className="font-bold text-black dark:text-white">
                            {tech._id.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        {isBusy ? (
                          <Badge variant="lightWarning" className="text-[10px] px-2 py-0.5 font-bold">
                            Busy
                          </Badge>
                        ) : (
                          <Badge variant="lightSuccess" className="text-[10px] px-2 py-0.5 font-bold">
                            Available
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-5 text-gray-600 dark:text-gray-300">{tech.pending || 0}</td>
                      <td className="py-3 px-5 text-gray-600 dark:text-gray-300">{tech.completedToday || 0}</td>
                      <td className="py-3 px-5 text-gray-600 dark:text-gray-300">
                        {tech.completed > 0
                          ? Math.round(tech.totalTime / tech.completed) + ' hrs'
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resident Feedback */}
        <h3 className="text-sm font-bold text-black dark:text-white mb-4">Resident Feedback</h3>
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          {data?.recentComplaints?.filter((c) => c.rating).length > 0 ? (
            <div className="space-y-3">
              {data.recentComplaints
                .filter((c) => c.rating)
                .map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stroke bg-gray-50 p-4 dark:border-strokedark dark:bg-meta-4/20 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-black dark:text-white">
                        {c.residentName}{' '}
                        <span className="font-medium text-gray-400 dark:text-gray-500">
                          &middot; #{c.complaintNumber}
                        </span>
                      </span>
                      <div className="flex gap-0.5 text-amber-400">
                        {[...Array(5)].map((_, idx) => (
                          <Star
                            key={idx}
                            className={`h-3.5 w-3.5 ${idx < c.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {c.feedback && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                        &ldquo;{c.feedback}&rdquo;
                      </p>
                    )}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                      {new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center text-sm text-gray-400 dark:text-gray-500">
              No feedback available.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PerformanceAnalytics
