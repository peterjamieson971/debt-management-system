export type UserRole = 'admin' | 'manager' | 'collector' | 'viewer' | 'system_admin'

export interface UserPermissions {
  canManageUsers: boolean
  canManageSettings: boolean
  canManageOrganization: boolean
  canViewAnalytics: boolean
  canManageCases: boolean
  canCommunicate: boolean
  canViewPayments: boolean
  canManageWorkflows: boolean
  canAccessSystemSettings: boolean
  canManageAIConfig: boolean
  canViewAICosts: boolean
  canManageIntegrations: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  viewer: {
    canManageUsers: false,
    canManageSettings: false,
    canManageOrganization: false,
    canViewAnalytics: false,
    canManageCases: false,
    canCommunicate: false,
    canViewPayments: false,
    canManageWorkflows: false,
    canAccessSystemSettings: false,
    canManageAIConfig: false,
    canViewAICosts: false,
    canManageIntegrations: false
  },
  collector: {
    canManageUsers: false,
    canManageSettings: false,
    canManageOrganization: false,
    canViewAnalytics: false,
    canManageCases: true,
    canCommunicate: true,
    canViewPayments: true,
    canManageWorkflows: false,
    canAccessSystemSettings: false,
    canManageAIConfig: false,
    canViewAICosts: false,
    canManageIntegrations: false
  },
  manager: {
    canManageUsers: false,
    canManageSettings: false,
    canManageOrganization: false,
    canViewAnalytics: true,
    canManageCases: true,
    canCommunicate: true,
    canViewPayments: true,
    canManageWorkflows: true,
    canAccessSystemSettings: false,
    canManageAIConfig: false,
    canViewAICosts: true,
    canManageIntegrations: false
  },
  admin: {
    canManageUsers: true,
    canManageSettings: true,
    canManageOrganization: true,
    canViewAnalytics: true,
    canManageCases: true,
    canCommunicate: true,
    canViewPayments: true,
    canManageWorkflows: true,
    canAccessSystemSettings: false,
    canManageAIConfig: true,
    canViewAICosts: true,
    canManageIntegrations: true
  },
  system_admin: {
    canManageUsers: true,
    canManageSettings: true,
    canManageOrganization: true,
    canViewAnalytics: true,
    canManageCases: true,
    canCommunicate: true,
    canViewPayments: true,
    canManageWorkflows: true,
    canAccessSystemSettings: true,
    canManageAIConfig: true,
    canViewAICosts: true,
    canManageIntegrations: true
  }
}

export function getUserPermissions(role: UserRole): UserPermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
}

export function hasPermission(role: UserRole, permission: keyof UserPermissions): boolean {
  return getUserPermissions(role)[permission]
}

export function isSystemAdmin(role: UserRole): boolean {
  return role === 'system_admin'
}

export function canAccessAdminFeatures(role: UserRole): boolean {
  return role === 'admin' || role === 'system_admin'
}

export function canManageSystemSettings(role: UserRole): boolean {
  return role === 'system_admin'
}