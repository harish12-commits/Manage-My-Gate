import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchMasterPricing,
  createPricingItem,
  updatePricingItem,
  deletePricingItem,
  clearError,
} from '../store/pricingSlice.js'

export const useMasterPricing = () => {
  const dispatch = useDispatch()
  const { items, loading, error, pagination } = useSelector((state) => state.pricing)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const loadPricing = useCallback(
    (params = {}) => {
      dispatch(fetchMasterPricing(params))
    },
    [dispatch],
  )

  useEffect(() => {
    loadPricing()
  }, [loadPricing])

  const openModal = (item = null) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setEditingItem(null)
    setIsModalOpen(false)
    dispatch(clearError())
  }

  const handleSubmit = async (formData) => {
    let resultAction
    if (editingItem && editingItem._id) {
      resultAction = await dispatch(
        updatePricingItem({ id: editingItem._id, updateData: formData }),
      )
    } else {
      resultAction = await dispatch(createPricingItem(formData))
    }

    if (resultAction.type.endsWith('fulfilled')) {
      closeModal()
      return true
    }
    return false
  }

  const handleDisable = async (item) => {
    await dispatch(
      updatePricingItem({
        id: item._id,
        updateData: { status: item.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' },
      }),
    )
  }

  const handleDelete = async (id) => {
    await dispatch(deletePricingItem(id))
  }

  return {
    items,
    loading,
    error,
    pagination,
    isModalOpen,
    editingItem,
    loadPricing,
    openModal,
    closeModal,
    handleSubmit,
    handleDisable,
    handleDelete,
  }
}
