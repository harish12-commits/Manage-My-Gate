import React from 'react'
import { CSpinner } from '@coreui/react'
import useResidentDiscover from '../hooks/useResidentDiscover.js'
import AmenityCardHorizontal from '../components/common/AmenityCardHorizontal.jsx'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import '../styles/_amenities.scss'
import AppLoader from '../../../components/common/AppLoader'

const ResidentDiscoverView = () => {
  const { items, loading, error, search, setSearch, navigateToBooking } = useResidentDiscover()

  const activeCount = items.filter((a) => a.status === 'active').length
  const maintenanceCount = items.filter(
    (a) => a.status === 'maintenance' || a.currentStatus === 'Under Maintenance',
  ).length

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />

      <div className="view-container">
        {/* ── Hero Header ── */}
        <div className="discover-hero">
          <div className="discover-hero__text">
            <p className="discover-hero__eyebrow">
              <i className="fa-solid fa-sparkles"></i> Community Amenities
            </p>
            <h1 className="discover-hero__title">Find Your Perfect Space</h1>
            <p className="discover-hero__subtitle">
              Browse and instantly book premium community amenities.
            </p>
          </div>

          {/* Search Bar */}
          <div className="discover-search">
            <div className="discover-search__input-wrap">
              <i className="fa-solid fa-magnifying-glass discover-search__icon"></i>
              <input
                type="text"
                className="discover-search__input"
                placeholder="Search by name, type or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="discover-search__clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Row */}
          {!loading && items.length > 0 && (
            <div className="discover-stats-row">
              <span className="discover-stat-chip">
                <i className="fa-solid fa-building-columns"></i>
                {items.length} Amenities
              </span>
              <span className="discover-stat-chip available">
                <i className="fa-solid fa-circle-check"></i>
                {activeCount} Available
              </span>
              {maintenanceCount > 0 && (
                <span className="discover-stat-chip maintenance">
                  <i className="fa-solid fa-wrench"></i>
                  {maintenanceCount} Maintenance
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 rounded-3">
            <i className="fa-solid fa-triangle-exclamation"></i>
            {error}
          </div>
        )}

        {/* ── Content ── */}
        {loading && items.length === 0 ? (
          <div className="discover-loading">
            <AppLoader variant="block" />
            <p>Loading amenities...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="discover-empty">
            <div className="discover-empty__icon">
              <i className="fa-solid fa-building-slash"></i>
            </div>
            <h4>No amenities found</h4>
            <p>
              {search
                ? `No results for "${search}". Try a different search term.`
                : 'No amenities are currently available.'}
            </p>
            {search && (
              <button className="btn btn-primary" onClick={() => setSearch('')}>
                <i className="fa-solid fa-xmark"></i> Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="discover-grid">
            {items.map((amenity) => (
              <AmenityCardHorizontal
                key={amenity._id}
                image={amenity.images?.[0] || amenity.imageUrl}
                title={amenity.name}
                category={amenity.type}
                description={amenity.description || 'Enjoy our premium community facilities.'}
                location={amenity.location}
                capacity={amenity.capacity}
                operatingHours={
                  amenity.bookingRules?.openTime && amenity.bookingRules?.closeTime
                    ? `${amenity.bookingRules.openTime} – ${amenity.bookingRules.closeTime}`
                    : undefined
                }
                rate={amenity.ratePerHour || amenity.pricing?.baseRate || 0}
                status={
                  amenity.status === 'maintenance' || amenity.currentStatus === 'Under Maintenance'
                    ? 'Maintenance'
                    : amenity.status === 'active'
                      ? 'Active'
                      : 'Inactive'
                }
                onClick={
                  amenity.status === 'maintenance' || amenity.currentStatus === 'Under Maintenance'
                    ? null
                    : () => navigateToBooking(amenity._id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ResidentDiscoverView
