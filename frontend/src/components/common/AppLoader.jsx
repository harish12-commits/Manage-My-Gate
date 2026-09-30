/**
 * AppLoader
 *
 * Theme-aware loading indicator used for every Suspense fallback and
 * page-level loading state. Colours come from CoreUI CSS variables, so it
 * follows the active light / dark / auto colour mode with no JS.
 *
 * Variants:
 * - fullscreen: covers the viewport (app boot, top-level route chunks)
 * - page:       fills the content area (feature route chunks)
 * - block:      compact centred spinner for cards, tables and modals
 * - inline:     small spinner for buttons, cards and panels
 *
 * The loader fades in after a short delay (pure CSS) so fast chunk loads
 * never flash a spinner. Animations use transform/opacity only.
 */
import React from 'react'
import PropTypes from 'prop-types'

const AppLoader = ({ variant = 'page', label = 'Loading…', className = '' }) => (
  <div
    className={`app-loader app-loader--${variant} ${className}`.trim()}
    role="status"
    aria-live="polite"
  >
    <div className="app-loader__spinner" aria-hidden="true">
      <span className="app-loader__ring" />
      <span className="app-loader__core" />
    </div>
    {variant !== 'inline' && <span className="app-loader__label">{label}</span>}
    <span className="visually-hidden">{label}</span>
  </div>
)

AppLoader.propTypes = {
  variant: PropTypes.oneOf(['fullscreen', 'page', 'block', 'inline']),
  label: PropTypes.string,
  className: PropTypes.string,
}

export default React.memo(AppLoader)
