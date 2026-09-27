import React from 'react';
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FileText, Search } from 'lucide-react';
import { useAdminLedgers } from '../hooks/useAdminLedgers.js';
import '../styles/_amenities.scss';
import toast from 'react-hot-toast';

const AdminLedgersView = () => {
  const { bookings, loading, search, handleSearchChange } = useAdminLedgers();

  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) {
      toast.error('No booking records available to export.');
      return;
    }

    const exportData = bookings.map((b) => {
      const userObj = b.userId || {};
      const amenityObj = b.amenityId || {};
      const residentName = userObj.name || userObj.username || b.userName || 'Community Resident';
      const villaUnit = b.villaNumber || userObj.villaNumber || userObj.flatNumber || userObj.unit || 'N/A';
      const amenityName = amenityObj.name || b.amenityName || 'Amenity';

      const bookingAmt = Number(b.bookingAmount || b.pricingDetails?.totalAmount || b.totalPrice || 0);
      const paidAmt = Number(b.paidAmount || (['confirmed', 'checked-in', 'completed'].includes(b.status) || ['paid', 'success', 'captured'].includes(b.paymentStatus) ? bookingAmt : 0));
      const refundedAmt = Number(b.refundAmount || b.pricingDetails?.refundAmount || 0);
      const netRev = Math.max(0, paidAmt - refundedAmt);

      return {
        'Booking Reference': b.bookingId || (b._id ? `#${b._id.substring(b._id.length - 6).toUpperCase()}` : 'N/A'),
        'Resident Name': residentName,
        'Unit / Villa': villaUnit,
        'Amenity Name': amenityName,
        'Booking Date': b.bookingDate || '',
        'Start Time': b.startTime || '',
        'End Time': b.endTime || '',
        'Headcount / Persons': b.numberOfPersons || 1,
        'Booking Amount (₹)': bookingAmt,
        'Paid Amount (₹)': paidAmt,
        'Refunded Amount (₹)': refundedAmt,
        'Net Revenue (₹)': netRev,
        'Payment Status': (b.paymentStatus || 'pending').toUpperCase(),
        'Booking Status': (b.status || 'pending').toUpperCase(),
        'Payment Method': b.paymentMethod || 'Online',
        'Transaction Reference': b.paymentId || b.razorpayTransactionId || 'N/A',
        'Created Date': b.createdAt ? new Date(b.createdAt).toLocaleString() : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const dateStr = new Date().toISOString().split('T')[0];
    saveAs(blob, `amenity_master_ledger_${dateStr}.csv`);
    toast.success('Ledger exported as CSV successfully');
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed': return <span className="badge badge-success" style={{ textTransform: 'capitalize' }}><i className="fa-solid fa-check-circle"></i> Confirmed</span>;
      case 'pending': return <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}><i className="fa-solid fa-clock"></i> Pending</span>;
      case 'cancelled': return <span className="badge" style={{ textTransform: 'capitalize', background: '#fee2e2', color: '#ef4444' }}><i className="fa-solid fa-times-circle"></i> Cancelled</span>;
      case 'checked-in': return <span className="badge badge-info" style={{ textTransform: 'capitalize' }}><i className="fa-solid fa-sign-in-alt"></i> Checked In</span>;
      case 'completed': return <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}><i className="fa-solid fa-flag-checkered"></i> Completed</span>;
      default: return <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{status}</span>;
    }
  };

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        <div className="view active" id="view-admin-bookings">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <h3 style={{ marginBottom: '4px' }} className="fs-3 font-bold text-black dark:text-white">Booking Master Ledger</h3>
                <p style={{ color: 'var(--text-muted)' }} className="fw-medium small">Bookings are auto-confirmed via payment gateway. No manual approval required.</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <div className="search-bar-app" style={{ margin: 0, padding: '8px 16px', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)', borderRadius: '24px', backgroundColor: 'var(--bg-light)' }}>
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input type="text" id="booking-search" placeholder="Search ID..." value={search} onChange={handleSearchChange} style={{ width: '140px', border: 'none', outline: 'none', backgroundColor: 'transparent' }} />
                </div>
                <button 
                  className="btn btn-primary fw-semibold text-white bg-primary hover:bg-primary-hover px-5 py-2.5 rounded-full flex items-center gap-2 cursor-pointer shadow-md shrink-0"
                  onClick={handleExportCSV}
                  type="button"
                >
                  <FileText className="w-4 h-4 text-white shrink-0" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
            
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ent-table" id="bookings-ledger">
                <thead>
                  <tr>
                    <th>BOOKING ID</th>
                    <th>RESIDENT</th>
                    <th>AMENITY & SLOT</th>
                    <th>FINANCIALS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Loading bookings...</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No bookings found</td></tr>
                  ) : (
                    bookings.map(b => (
                      <tr key={b._id} data-status={b.status}>
                        <td style={{ color: 'var(--primary)' }} className="fw-bold">#{b.bookingId || b._id.substring(b._id.length - 4).toUpperCase()}</td>
                        <td>
                          <div  className="fw-bold">{b.userId?.name || 'Unknown Resident'}</div>
                          <div style={{ color: 'var(--text-muted)' }} className="fw-medium small">
                            {b.userId?.flatNumber ? `Flat ${b.userId.flatNumber}` : ''}{b.userId?.building ? `, ${b.userId.building}` : ''}
                          </div>
                        </td>
                        <td>
                          <div  className="fw-bold">{b.amenityId?.name || 'Unknown Amenity'}</div>
                          <div style={{ color: 'var(--text-muted)' }} className="fw-medium small">
                            {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) : ''} • {b.startTime} - {b.endTime}
                          </div>
                        </td>
                        <td>
                          <div  className="fw-bold">₹{b.pricingDetails?.totalAmount || b.totalPrice || 0}</div>
                          <div style={{ color: 'var(--text-muted)' }} className="fw-medium small">
                            {b.paymentStatus === 'success' || b.paymentStatus === 'completed' || b.paymentStatus === 'paid' ? 'Paid' : (b.paymentStatus || 'Pending')}
                          </div>
                        </td>
                        <td>{getStatusBadge(b.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLedgersView;
