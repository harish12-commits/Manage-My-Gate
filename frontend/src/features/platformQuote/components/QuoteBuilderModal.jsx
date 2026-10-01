import React from 'react'
import SubscriptionConfigurator from './SubscriptionConfigurator.jsx'

const QuoteBuilderModal = ({ isOpen, onClose, quoteId = null }) => {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="text-xl font-bold">Build Custom Quote</h2>
          <button className="btn small" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <SubscriptionConfigurator quoteId={quoteId} />
        </div>
      </div>
    </div>
  )
}

export default QuoteBuilderModal
