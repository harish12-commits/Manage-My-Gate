import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchRolesAsync,
  createRoleAsync,
  updateRoleAsync,
  deleteRoleAsync,
  fetchPermissions,
  setCurrentPage,
  setRowsPerPage,
} from '../store/roleSlice'

/**
 * useRoles Custom Hook
 *
 * Reusable controller hook encapsulating all Redux selectors and actions
 * for the Role Builder feature. Follows the "Thin View" architectural pattern.
 */
export const useRoles = () => {
  const dispatch = useDispatch()
  const {
    roles,
    isLoading,
    error,
    permissionsList,
    isPermissionsLoading,
    totalRecords,
    currentPage,
    totalPages,
    rowsPerPage,
  } = useSelector((state) => state.roleBuilder)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState(null)

  // Fetch roles when pagination states change
  useEffect(() => {
    dispatch(fetchRolesAsync({ page: currentPage, limit: rowsPerPage }))
  }, [dispatch, currentPage, rowsPerPage])

  const loadPermissions = useCallback(() => {
    dispatch(fetchPermissions())
  }, [dispatch])

  const openCreateModal = () => {
    setSelectedRoleForEdit(null)
    setIsModalOpen(true)
  }

  const openEditModal = (role) => {
    setSelectedRoleForEdit(role)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedRoleForEdit(null)
    setIsModalOpen(false)
  }

  const handleSaveRole = async (data) => {
    try {
      let result
      if (selectedRoleForEdit) {
        // Edit mode
        const roleId = selectedRoleForEdit.id || selectedRoleForEdit._id
        result = await dispatch(updateRoleAsync({ roleId, roleData: data })).unwrap()
      } else {
        // Create mode
        result = await dispatch(createRoleAsync(data)).unwrap()
      }
      closeModal()
      dispatch(fetchRolesAsync({ page: currentPage, limit: rowsPerPage }))
      return result
    } catch (err) {
      console.error('Failed to save role:', err)
      throw err
    }
  }

  const handleDeleteRole = async (id) => {
    try {
      await dispatch(deleteRoleAsync(id)).unwrap()
      dispatch(fetchRolesAsync({ page: currentPage, limit: rowsPerPage }))
    } catch (err) {
      console.error('Failed to delete role:', err)
    }
  }

  const handlePageChange = (newPage) => {
    dispatch(setCurrentPage(newPage))
  }

  const handleRowsPerPageChange = (newLimit) => {
    dispatch(setRowsPerPage(newLimit))
    dispatch(setCurrentPage(1))
  }

  return {
    roles,
    isLoading,
    error,
    permissionsList,
    isPermissionsLoading,
    isModalOpen,
    selectedRoleForEdit,
    totalRecords,
    currentPage,
    totalPages,
    rowsPerPage,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSaveRole,
    handleDeleteRole,
    loadPermissions,
    handlePageChange,
    handleRowsPerPageChange,
  }
}

export default useRoles
