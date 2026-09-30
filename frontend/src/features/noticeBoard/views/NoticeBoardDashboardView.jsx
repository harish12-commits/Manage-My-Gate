import React, { useEffect } from 'react'
import { CSpinner } from '@coreui/react'
import useNoticeBoard from '../hooks/useNoticeBoard.js'
import useNoticeSocket from '../hooks/useNoticeSocket.js'
import NoticeBoardTopNav from '../components/NoticeBoardTopNav.jsx'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../styles/_noticeBoard.scss'
import AppLoader from '../../../components/common/AppLoader'

const NoticeBoardDashboardView = () => {
  useNoticeSocket()
  const { dashboardStats, dashboardLoading, dashboardError, loadNoticeStats } = useNoticeBoard()

  useEffect(() => {
    loadNoticeStats()
  }, [loadNoticeStats])

  const handleExport = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['Notice Board Summary Report'],
      [],
      ['Metric', 'Count'],
      ['Active Notices', dashboardStats?.kpis?.activeNotices || 0],
      ['Draft Notices', dashboardStats?.kpis?.draftNotices || 0],
      ['Scheduled Notices', dashboardStats?.kpis?.scheduledNotices || 0],
      ['Archived Notices', dashboardStats?.kpis?.archivedNotices || 0],
      ['Expired Notices', dashboardStats?.kpis?.expiredNotices || 0],
      ['Urgent/Critical Notices', dashboardStats?.kpis?.urgentNotices || 0],
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Categories Sheet
    const categoriesData = [
      ['Category', 'Notice Count'],
      ['General', dashboardStats?.categories?.General || 0],
      ['Maintenance', dashboardStats?.categories?.Maintenance || 0],
      ['Events', dashboardStats?.categories?.Events || 0],
      ['Emergency', dashboardStats?.categories?.Emergency || 0],
      ['Meetings', dashboardStats?.categories?.Meetings || 0],
    ]
    const categoriesWs = XLSX.utils.aoa_to_sheet(categoriesData)
    XLSX.utils.book_append_sheet(wb, categoriesWs, 'Categories')

    // Activity Sheet
    if (dashboardStats?.recentActivity && dashboardStats.recentActivity.length > 0) {
      const activityData = [['Title', 'Category', 'Priority', 'Status', 'Creator', 'Created At']]
      dashboardStats.recentActivity.forEach((item) => {
        activityData.push([
          item.title || 'N/A',
          item.category || 'N/A',
          item.priority || 'N/A',
          item.status || 'N/A',
          item.creatorName || 'N/A',
          item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A',
        ])
      })
      const activityWs = XLSX.utils.aoa_to_sheet(activityData)
      XLSX.utils.book_append_sheet(wb, activityWs, 'Recent Notices')
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    saveAs(blob, 'notice_board_report.xlsx')
  }

  const totalCount = dashboardStats?.kpis?.totalNotices || 0
  const activeCount = dashboardStats?.kpis?.activeNotices || 0
  const urgentCount = dashboardStats?.kpis?.urgentNotices || 0
  const draftCount = dashboardStats?.kpis?.draftNotices || 0
  const expiredCount = dashboardStats?.kpis?.expiredNotices || 0
  const scheduledCount = dashboardStats?.kpis?.scheduledNotices || 0
  const pinnedCount = dashboardStats?.kpis?.pinnedNotices || 0

  return (
    <div className="notice-board-theme pt-3">
      <div className="view-container">
        <NoticeBoardTopNav />

        {dashboardError && <div className="alert alert-danger mb-4">{dashboardError}</div>}

        {dashboardLoading && !dashboardStats ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <AppLoader variant="block" />
          </div>
        ) : (
          <div className="view active" id="view-notice-dashboard">
            {/* Header section */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '28px', margin: 0, fontWeight: '700' }}>
                  Management Overview
                </h2>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '15px',
                    fontWeight: '500',
                    margin: '4px 0 0',
                  }}
                >
                  Real-time metrics and notice board overview.
                </p>
              </div>
              <button className="btn-pill btn-pill-primary" onClick={handleExport}>
                <i className="fa-solid fa-download"></i> Export Report
              </button>
            </div>

            {/* KPI grid */}
            <div className="dashboard-grid">
              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-list-check"
                    style={{ color: 'var(--primary)', marginRight: '8px' }}
                  ></i>
                  Total Notices
                </div>
                <div className="kpi-value">{totalCount}</div>
                <div className="kpi-trend text-primary">All statuses</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-check-circle"
                    style={{ color: 'var(--success)', marginRight: '8px' }}
                  ></i>
                  Active Notices
                </div>
                <div className="kpi-value">{activeCount}</div>
                <div className="kpi-trend text-success">Published</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-pen-ruler"
                    style={{ color: 'var(--warning)', marginRight: '8px' }}
                  ></i>
                  Drafts
                </div>
                <div className="kpi-value">{draftCount}</div>
                <div className="kpi-trend text-warning">Unpublished</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-clock"
                    style={{ color: 'var(--info)', marginRight: '8px' }}
                  ></i>
                  Scheduled
                </div>
                <div className="kpi-value">{scheduledCount}</div>
                <div className="kpi-trend text-info">To be published</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-ban"
                    style={{ color: 'var(--text-light)', marginRight: '8px' }}
                  ></i>
                  Expired Notices
                </div>
                <div className="kpi-value">{expiredCount}</div>
                <div className="kpi-trend text-light">Past Due</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-thumbtack"
                    style={{ color: 'var(--primary-dark)', marginRight: '8px' }}
                  ></i>
                  Pinned
                </div>
                <div className="kpi-value">{pinnedCount}</div>
                <div className="kpi-trend text-primary-dark">Featured</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-title">
                  <i
                    className="fa-solid fa-triangle-exclamation"
                    style={{ color: 'var(--danger)', marginRight: '8px' }}
                  ></i>
                  Urgent & Critical
                </div>
                <div className="kpi-value">{urgentCount}</div>
                <div className="kpi-trend text-danger">Priority High+</div>
              </div>
            </div>

            {/* Charts & Activity Logs */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '32px' }}
              className="mb-4"
            >
              {/* Category Breakdown */}
              <div className="bar-chart-card">
                <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>
                  Notices by Category
                </h4>
                <div className="bar-chart">
                  {Object.entries(dashboardStats?.categories || {}).map(([category, count]) => {
                    const counts = Object.values(dashboardStats?.categories || {})
                    const maxCount = Math.max(...counts, 1)
                    const heightPercent = `${Math.min(100, Math.max(10, (count / maxCount) * 100))}%`

                    return (
                      <div className="bar-col" key={category}>
                        <div
                          className="bar-primary"
                          style={{ height: heightPercent }}
                          title={`${count} notices`}
                        ></div>
                        <span className="bar-label">{category}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Activity Logs */}
              <div className="activity-log-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <h4 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                    Live Activity Log
                  </h4>
                  <span
                    className="kpi-trend text-success"
                    style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '50px' }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        backgroundColor: 'var(--success)',
                        borderRadius: '50%',
                      }}
                    ></span>
                    LIVE
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {dashboardStats?.recentActivity && dashboardStats.recentActivity.length > 0 ? (
                    dashboardStats.recentActivity.map((activity, index) => (
                      <div className="activity-item" key={activity.id || index}>
                        <div className="activity-icon">
                          <i
                            className={`fa-solid ${activity.category === 'Emergency' ? 'fa-triangle-exclamation text-danger' : 'fa-info-circle'}`}
                          ></i>
                        </div>
                        <div className="activity-body">
                          <h5
                            className="activity-title"
                            style={{ fontSize: '14px', margin: '0 0 2px 0' }}
                          >
                            {activity.title}
                          </h5>
                          <p
                            className="activity-desc"
                            style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}
                          >
                            {activity.category} • {activity.priority} Priority • {activity.status}
                          </p>
                        </div>
                        <div
                          className="activity-time"
                          style={{ fontSize: '11px', color: 'var(--text-light)' }}
                        >
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      No recent activity
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NoticeBoardDashboardView
