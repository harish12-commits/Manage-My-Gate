// Polyfill localStorage for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const {
  default: organizationReducer,
  createOrganization,
  clearCreateOrganizationState,
} = await import('../src/features/organization/store/organizationSlice.js')
const organizationApi = (await import('../src/features/organization/services/organizationApi.js'))
  .default
const { default: apiClient } = await import('../src/services/apiClient.js')

describe('Frontend Organization Feature: Redux & State Lifecycle Tests', () => {
  const baseInitialState = organizationReducer(undefined, { type: '@@INIT' })

  it('should initialize with createLoading false and createError null', () => {
    assert.equal(baseInitialState.createLoading, false)
    assert.equal(baseInitialState.createError, null)
    assert.equal(baseInitialState.currentCreatedOrganization, null)
  })

  it('should handle createOrganization.pending by setting createLoading to true', () => {
    const nextState = organizationReducer(baseInitialState, {
      type: createOrganization.pending.type,
    })

    assert.equal(nextState.createLoading, true)
    assert.equal(nextState.createError, null)
  })

  it('should handle createOrganization.fulfilled by populating currentCreatedOrganization and clearing loading', () => {
    const payload = {
      token: 'mock-scoped-token',
      user: {
        orgId: 'org-12345',
        organizationName: 'Grand Palm Resort',
        role: 'Community Admin',
      },
      availableWorkspaces: [
        { orgId: 'org-12345', name: 'Grand Palm Resort', role: 'Community Admin' },
      ],
    }

    const nextState = organizationReducer(
      { ...baseInitialState, createLoading: true },
      {
        type: createOrganization.fulfilled.type,
        payload: payload,
      },
    )

    assert.equal(nextState.createLoading, false)
    assert.equal(nextState.createError, null)
    assert.deepEqual(nextState.currentCreatedOrganization, {
      id: 'org-12345',
      name: 'Grand Palm Resort',
    })
  })

  it('should handle createOrganization.rejected by storing error message and clearing loading', () => {
    const nextState = organizationReducer(
      { ...baseInitialState, createLoading: true },
      {
        type: createOrganization.rejected.type,
        payload: 'Conflict. Organization name already exists.',
      },
    )

    assert.equal(nextState.createLoading, false)
    assert.equal(nextState.createError, 'Conflict. Organization name already exists.')
  })

  it('should reset creation state when clearCreateOrganizationState action is dispatched', () => {
    const dirtyState = {
      ...baseInitialState,
      createLoading: false,
      createError: 'Some previous error',
      currentCreatedOrganization: { id: 'org-old', name: 'Old Org' },
    }

    const cleanedState = organizationReducer(dirtyState, clearCreateOrganizationState())

    assert.equal(cleanedState.createLoading, false)
    assert.equal(cleanedState.createError, null)
    assert.equal(cleanedState.currentCreatedOrganization, null)
  })
})

describe('Workspace Switcher Visibility Contract Tests', () => {
  const shouldRenderSwitcher = (availableWorkspaces) => {
    return Boolean(availableWorkspaces && availableWorkspaces.length > 0)
  }

  it('should NOT render when user has 0 workspaces (e.g. initial registration)', () => {
    assert.equal(shouldRenderSwitcher([]), false)
    assert.equal(shouldRenderSwitcher(null), false)
    assert.equal(shouldRenderSwitcher(undefined), false)
  })

  it('should render when user has exactly 1 organization so they can access Create New Organization', () => {
    const singleWorkspace = [{ orgId: 'org-1', name: 'Palm Grove', role: 'Community Admin' }]
    assert.equal(shouldRenderSwitcher(singleWorkspace), true)
  })

  it('should render when user has multiple organizations', () => {
    const multiWorkspaces = [
      { orgId: 'org-1', name: 'Palm Grove', role: 'Community Admin' },
      { orgId: 'org-2', name: 'Cedar Valley', role: 'Resident' },
    ]
    assert.equal(shouldRenderSwitcher(multiWorkspaces), true)
  })
})

describe('Organization API Service & Validation Rules Tests', () => {
  it('should expose checkOrganizationName and setupWorkspace on organizationApi', () => {
    assert.equal(typeof organizationApi.checkOrganizationName, 'function')
    assert.equal(typeof organizationApi.setupWorkspace, 'function')
  })

  it('should route checkOrganizationName through GET /organizations/check-name with params', async () => {
    let capturedUrl = null
    let capturedConfig = null
    const originalGet = apiClient.get

    apiClient.get = async (url, config) => {
      capturedUrl = url
      capturedConfig = config
      return { data: { success: true, data: { available: true } } }
    }

    try {
      const res = await organizationApi.checkOrganizationName('Greenfield Community')
      assert.equal(capturedUrl, '/organizations/check-name')
      assert.deepEqual(capturedConfig, { params: { name: 'Greenfield Community' } })
      assert.equal(res.data.success, true)
    } finally {
      apiClient.get = originalGet
    }
  })

  it('should route setupWorkspace through POST /organizations/setup with workspace body', async () => {
    let capturedUrl = null
    let capturedBody = null
    const originalPost = apiClient.post

    apiClient.post = async (url, body) => {
      capturedUrl = url
      capturedBody = body
      return { data: { success: true, data: { token: 'mock-token' } } }
    }

    try {
      const payload = {
        name: 'Hilltop Villas',
        organizationType: 'Residential',
        timezone: 'Asia/Kolkata',
      }
      const res = await organizationApi.setupWorkspace(payload)
      assert.equal(capturedUrl, '/organizations/setup')
      assert.deepEqual(capturedBody, payload)
      assert.equal(res.data.success, true)
    } finally {
      apiClient.post = originalPost
    }
  })

  it('should validate organization name bounds: min 3 and max 100 characters', () => {
    const validateName = (name) => {
      if (!name || typeof name !== 'string') return 'Required'
      const trimmed = name.trim()
      if (trimmed.length < 3) return 'Too short'
      if (trimmed.length > 100) return 'Too long'
      return null
    }

    assert.equal(validateName(''), 'Required')
    assert.equal(validateName('   '), 'Too short')
    assert.equal(validateName('ab'), 'Too short')
    assert.equal(validateName('abc'), null)
    assert.equal(validateName('Valid Organization Name'), null)
    assert.equal(validateName('a'.repeat(100)), null)
    assert.equal(validateName('a'.repeat(101)), 'Too long')
  })
})
