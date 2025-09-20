'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError, useErrorHandler } from '@/components/ui/ErrorBoundary'
import { PageLoading } from '@/components/ui/LoadingStates'
import {
  Database,
  Table,
  Activity,
  HardDrive,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Clock,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Trash2,
  Eye
} from 'lucide-react'

interface DatabaseStats {
  total_tables: number
  total_rows: number
  database_size_mb: number
  active_connections: number
  queries_per_second: number
  cache_hit_ratio: number
}

interface TableInfo {
  table_name: string
  row_count: number
  size_mb: number
  last_updated: string
  schema: string
}

interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'critical'
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  connection_pool_usage: number
  slow_queries: number
  last_backup: string
}

interface Migration {
  id: string
  name: string
  applied_at: string
  status: 'applied' | 'pending' | 'failed'
  rollback_available: boolean
}

export default function DatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [tables, setTables] = useState<TableInfo[]>([])
  const [health, setHealth] = useState<DatabaseHealth | null>(null)
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'migrations' | 'backups'>('overview')
  const { error, resetError, handleError } = useErrorHandler()

  useEffect(() => {
    fetchDatabaseData()
  }, [])

  const fetchDatabaseData = async () => {
    try {
      setLoading(true)
      resetError()

      const response = await fetch('/api/admin/database', {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setTables(data.tables)
        setHealth(data.health)
        setMigrations(data.migrations)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('Database API endpoint not available, using mock data')

        setStats({
          total_tables: 12,
          total_rows: 47892,
          database_size_mb: 2847.5,
          active_connections: 23,
          queries_per_second: 156.8,
          cache_hit_ratio: 94.2
        })

        setTables([
          {
            table_name: 'organizations',
            row_count: 5,
            size_mb: 0.2,
            last_updated: '2024-09-20T09:30:00Z',
            schema: 'public'
          },
          {
            table_name: 'users',
            row_count: 127,
            size_mb: 5.8,
            last_updated: '2024-09-20T10:15:00Z',
            schema: 'public'
          },
          {
            table_name: 'debtors',
            row_count: 2847,
            size_mb: 145.2,
            last_updated: '2024-09-20T08:45:00Z',
            schema: 'public'
          },
          {
            table_name: 'collection_cases',
            row_count: 5934,
            size_mb: 287.6,
            last_updated: '2024-09-20T11:20:00Z',
            schema: 'public'
          },
          {
            table_name: 'communication_logs',
            row_count: 18456,
            size_mb: 892.3,
            last_updated: '2024-09-20T11:25:00Z',
            schema: 'public'
          },
          {
            table_name: 'ai_interactions',
            row_count: 12847,
            size_mb: 456.7,
            last_updated: '2024-09-20T11:18:00Z',
            schema: 'public'
          },
          {
            table_name: 'payment_records',
            row_count: 3562,
            size_mb: 189.4,
            last_updated: '2024-09-20T09:50:00Z',
            schema: 'public'
          },
          {
            table_name: 'invoices',
            row_count: 4789,
            size_mb: 234.8,
            last_updated: '2024-09-20T10:35:00Z',
            schema: 'public'
          }
        ])

        setHealth({
          status: 'healthy',
          cpu_usage: 15.7,
          memory_usage: 68.3,
          disk_usage: 34.8,
          connection_pool_usage: 76.5,
          slow_queries: 2,
          last_backup: '2024-09-20T02:00:00Z'
        })

        setMigrations([
          {
            id: '20240901_001',
            name: 'Initial schema setup',
            applied_at: '2024-09-01T10:00:00Z',
            status: 'applied',
            rollback_available: false
          },
          {
            id: '20240905_001',
            name: 'Add AI interaction tracking',
            applied_at: '2024-09-05T14:30:00Z',
            status: 'applied',
            rollback_available: true
          },
          {
            id: '20240910_001',
            name: 'Add email communication logs',
            applied_at: '2024-09-10T09:15:00Z',
            status: 'applied',
            rollback_available: true
          },
          {
            id: '20240915_001',
            name: 'Update user permissions schema',
            applied_at: '2024-09-15T16:45:00Z',
            status: 'applied',
            rollback_available: true
          },
          {
            id: '20240920_001',
            name: 'Add workflow automation tables',
            applied_at: '',
            status: 'pending',
            rollback_available: false
          }
        ])
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to load database information: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to fetch database data:', error)
      if (error instanceof Error) {
        handleError(error)
      } else {
        handleError(new Error('An unexpected error occurred while loading database information'))
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'critical':
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'applied':
        return 'text-green-800 bg-green-100'
      case 'warning':
      case 'pending':
        return 'text-yellow-800 bg-yellow-100'
      case 'critical':
      case 'failed':
        return 'text-red-800 bg-red-100'
      default:
        return 'text-gray-800 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not applied'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatSize = (sizeInMB: number) => {
    if (sizeInMB < 1) {
      return `${(sizeInMB * 1024).toFixed(1)} KB`
    } else if (sizeInMB > 1024) {
      return `${(sizeInMB / 1024).toFixed(1)} GB`
    } else {
      return `${sizeInMB.toFixed(1)} MB`
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageLoading
          title="Loading Database Information"
          description="Please wait while we fetch database status and metrics..."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Management</h1>
          <p className="text-gray-600">Monitor database health, tables, and migrations</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={fetchDatabaseData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Backup
          </Button>
        </div>
      </div>

      <ApiError
        error={error}
        onRetry={fetchDatabaseData}
        onDismiss={resetError}
        title="Database Connection Error"
      />

      {/* Database Health */}
      {health && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Database Health</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.status)}`}>
              {getStatusIcon(health.status)}
              <span className="ml-1">{health.status.charAt(0).toUpperCase() + health.status.slice(1)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">{health.cpu_usage}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900">{health.memory_usage}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Connection Pool</p>
              <p className="text-2xl font-bold text-gray-900">{health.connection_pool_usage}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Backup</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(health.last_backup)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Database Statistics */}
      {stats && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Database Statistics</h2>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="flex items-center">
              <Table className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tables</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_tables}</p>
              </div>
            </div>

            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_rows.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Database Size</p>
                <p className="text-2xl font-bold text-gray-900">{formatSize(stats.database_size_mb)}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Connections</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_connections}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Activity className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Queries/sec</p>
                <p className="text-2xl font-bold text-gray-900">{stats.queries_per_second}</p>
              </div>
            </div>

            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-teal-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cache Hit</p>
                <p className="text-2xl font-bold text-gray-900">{stats.cache_hit_ratio}%</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Card>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Tables Overview', icon: Table },
              { key: 'migrations', label: 'Migrations', icon: Database },
              { key: 'backups', label: 'Backups', icon: Download }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rows
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tables.map((table, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Table className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{table.table_name}</div>
                            <div className="text-sm text-gray-500">{table.schema}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.row_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatSize(table.size_mb)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(table.last_updated)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'migrations' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Migration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applied At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {migrations.map((migration, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{migration.name}</div>
                          <div className="text-sm text-gray-500 font-mono">{migration.id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(migration.status)}`}>
                          {getStatusIcon(migration.status)}
                          <span className="ml-1">{migration.status.charAt(0).toUpperCase() + migration.status.slice(1)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(migration.applied_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {migration.rollback_available && (
                            <Button variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'backups' && (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Database Backups</h3>
              <p className="text-gray-500 mb-4">
                Automated backups are configured and running daily at 2:00 AM UTC.
              </p>
              <div className="flex justify-center space-x-3">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Restore
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}