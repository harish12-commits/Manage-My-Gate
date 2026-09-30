import React from 'react'
import PropTypes from 'prop-types'
import { CFormInput, CFormSelect } from '@coreui/react'
import { useTranslation } from 'react-i18next'

const VillaToolbar = ({
  searchQuery,
  handleSearch,
  blockFilter,
  handleBlockChange,
  statusFilter,
  handleStatusChange,
  blocks,
  blocksLoading,
}) => {
  const { t } = useTranslation()
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center flex-grow-1">
      <div style={{ minWidth: 'min(350px, 100%)', maxWidth: '400px' }}>
        <CFormInput
          type="text"
          placeholder={t('villas.searchPlaceholder', 'Search unit number...')}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          size="sm"
        />
      </div>
      <CFormSelect
        value={blockFilter}
        onChange={(e) => handleBlockChange(e.target.value)}
        size="sm"
        disabled={blocksLoading}
        style={{ width: 'auto', minWidth: '150px' }}
      >
        <option value="">{t('villas.allBlocks', 'All Blocks')}</option>
        {blocks.map((block) => (
          <option key={block} value={block}>
            {block}
          </option>
        ))}
      </CFormSelect>
      <CFormSelect
        value={statusFilter}
        onChange={(e) => handleStatusChange(e.target.value)}
        size="sm"
        style={{ width: 'auto', minWidth: '150px' }}
      >
        <option value="">{t('villas.allStatuses', 'All Statuses')}</option>
        <option value="Vacant">{t('villas.statusTypes.Vacant', 'Vacant')}</option>
        <option value="Occupied">{t('villas.statusTypes.Occupied', 'Occupied')}</option>
        <option value="Under Maintenance">
          {t('villas.statusTypes.UnderMaintenance', 'Under Maintenance')}
        </option>
      </CFormSelect>
    </div>
  )
}

VillaToolbar.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  handleSearch: PropTypes.func.isRequired,
  blockFilter: PropTypes.string.isRequired,
  handleBlockChange: PropTypes.func.isRequired,
  statusFilter: PropTypes.string.isRequired,
  handleStatusChange: PropTypes.func.isRequired,
  blocks: PropTypes.arrayOf(PropTypes.string).isRequired,
  blocksLoading: PropTypes.bool.isRequired,
}

export default VillaToolbar
