import React, { memo } from 'react'

const CalendarHeader = memo(
  ({ currentDate, navigateDate, setToday, viewMode, setViewMode, hideViewOptions = false }) => {
    const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const weekYear = `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    const dayYear = currentDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const title = viewMode === 'week' ? weekYear : viewMode === 'day' ? dayYear : monthYear

    return (
      <div className="rcv-cal-header">
        <div className="rcv-cal-header__left">
          <div className="rcv-nav-group">
            <button className="rcv-btn-icon" onClick={() => navigateDate(-1)} aria-label="Previous">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              className="rcv-btn-ghost"
              onClick={setToday}
              style={{ marginLeft: '4px', marginRight: '4px' }}
            >
              Today
            </button>
            <button className="rcv-btn-icon" onClick={() => navigateDate(1)} aria-label="Next">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
          <h4 className="rcv-cal-header__title">{title}</h4>
        </div>

        {!hideViewOptions && (
          <div className="rcv-cal-header__right">
            <div className="rcv-view-toggle">
              <button
                className={`rcv-view-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
              <button
                className={`rcv-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button
                className={`rcv-view-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
            </div>
          </div>
        )}

        <style>{`
        .rcv-cal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #E2E8F0;
          background: #fff;
        }
        .rcv-cal-header__left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rcv-cal-header__title {
          font-size: 18px;
          font-weight: 700;
          color: #0F172A;
          letter-spacing: -0.02em;
          margin: 0;
          min-width: 180px;
        }
        .rcv-btn-ghost {
          padding: 7px 16px;
          border-radius: 8px;
          border: 1px solid #E2E8F0;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease, width 0.15s ease, height 0.15s ease, max-height 0.15s ease;
        }
        .rcv-btn-ghost:hover {
          background: #F0F7FF;
          border-color: #0084FF;
          color: #0084FF;
        }
        .rcv-nav-group {
          display: flex;
          gap: 2px;
        }
        .rcv-btn-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #E2E8F0;
          background: #fff;
          color: #64748B;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease, width 0.15s ease, height 0.15s ease, max-height 0.15s ease;
        }
        .rcv-btn-icon:hover {
          background: #F0F7FF;
          border-color: #0084FF;
          color: #0084FF;
        }
        .rcv-view-toggle {
          display: flex;
          background: #F1F5F9;
          padding: 4px;
          border-radius: 8px;
          gap: 2px;
        }
        .rcv-view-btn {
          padding: 6px 16px;
          border-radius: 6px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #64748B;
          cursor: pointer;
          transition: color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s;
        }
        .rcv-view-btn.active {
          background: #fff;
          color: #0F172A;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .rcv-view-btn:hover:not(.active) {
          color: #334155;
        }
      `}</style>
      </div>
    )
  },
)

export default CalendarHeader
