import React from 'react'
import logger from '../../utils/logger.js'
import config from '../../config/config.js'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // Log crash details using the environment-aware logger
    logger.error('React Component Crash:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          {/* Animated background glow elements */}
          <div style={styles.glowPurple} />
          <div style={styles.glowCyan} />

          <div style={styles.glassCard}>
            <div style={styles.iconContainer}>
              <svg
                style={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 style={styles.title}>Oops! Something went wrong</h1>
            <p style={styles.subtitle}>
              The application encountered an unexpected error. We have logged this issue and our
              team is investigating.
            </p>

            <div style={styles.buttonContainer}>
              <button
                onClick={this.handleReload}
                style={styles.reloadButton}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'none'
                  e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)'
                }}
              >
                Reload Application
              </button>
            </div>

            {/* Developer Details Accordion */}
            {config.isDev && (
              <details style={styles.details}>
                <summary style={styles.summary}>Technical details for developers</summary>
                <div style={styles.detailsContent}>
                  <p style={styles.errorText}>
                    <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre style={styles.stackTrace}>{this.state.errorInfo.componentStack}</pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Inline styling for visual excellence (fully responsive and modern)
const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#0b0f19',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#f3f4f6',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
    boxSizing: 'border-box',
  },
  glowPurple: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
    borderRadius: '50%',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  glowCyan: {
    position: 'absolute',
    bottom: '20%',
    right: '15%',
    width: '450px',
    height: '450px',
    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
    borderRadius: '50%',
    filter: 'blur(50px)',
    pointerEvents: 'none',
  },
  glassCard: {
    width: '100%',
    maxWidth: '560px',
    padding: '40px 32px',
    borderRadius: '24px',
    background: 'rgba(17, 24, 39, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    marginBottom: '24px',
  },
  icon: {
    width: '32px',
    height: '32px',
    color: '#ef4444',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '12px',
    background: 'linear-gradient(to right, #f3f4f6, #9ca3af)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '16px',
    color: '#9ca3af',
    lineHeight: '1.6',
    marginBottom: '32px',
    maxWidth: '440px',
  },
  buttonContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  reloadButton: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '12px',
    cursor: 'pointer',
    transition:
      'color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
    outline: 'none',
  },
  details: {
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    textAlign: 'left',
    marginTop: '12px',
    overflow: 'hidden',
  },
  summary: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#a1a1aa',
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: '500',
    outline: 'none',
  },
  detailsContent: {
    padding: '0 16px 16px 16px',
    fontSize: '13px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  errorText: {
    color: '#f87171',
    margin: '12px 0 8px 0',
    wordBreak: 'break-all',
  },
  stackTrace: {
    margin: '0',
    padding: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: '#e4e4e7',
    borderRadius: '8px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontSize: '12px',
    maxHeight: '160px',
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },
}

export default ErrorBoundary
