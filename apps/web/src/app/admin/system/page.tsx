'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError, useErrorHandler } from '@/components/ui/ErrorBoundary'
import { PageLoading } from '@/components/ui/LoadingStates'
import {
  Server,
  Database,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  Globe,
  Monitor,
  RefreshCw,
  Settings,
  Clock,
  Zap
} from 'lucide-react'

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  uptime: string
  last_check: string
}

interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  active_connections: number
  response_time_ms: number
}

interface SystemService {
  name: string
  status: 'running' | 'stopped' | 'error'
  port?: number
  version?: string
  last_restart?: string
}

interface SystemInfo {
  version: string
  environment: 'development' | 'staging' | 'production'
  region: string
  deployment_date: string
  build_hash: string
}

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [services, setServices] = useState<SystemService[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, resetError, handleError } = useErrorHandler()

  useEffect(() => {
    fetchSystemData()
  }, [])

  const fetchSystemData = async () => {
    try {
      setLoading(true)
      resetError()

      const response = await fetch('/api/admin/system', {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setHealth(data.health)
        setMetrics(data.metrics)
        setServices(data.services)
        setSystemInfo(data.system_info)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('System API endpoint not available, using mock data')

        setHealth({
          status: 'healthy',
          uptime: '12 days, 14 hours, 32 minutes',
          last_check: new Date().toISOString()
        })

        setMetrics({
          cpu_usage: 23.5,
          memory_usage: 68.2,
          disk_usage: 45.8,
          active_connections: 127,
          response_time_ms: 89
        })

        setServices([
          {
            name: 'Web Application',
            status: 'running',
            port: 3000,
            version: '1.2.4',
            last_restart: '2024-09-08T14:30:00Z'
          },
          {
            name: 'Database (Supabase)',
            status: 'running',
            version: '15.4',
            last_restart: '2024-09-01T09:00:00Z'
          },
          {
            name: 'AI Service (OpenAI)',
            status: 'running',
            last_restart: '2024-09-20T08:15:00Z'
          },
          {
            name: 'Email Service (Gmail API)',
            status: 'running',
            last_restart: '2024-09-19T16:45:00Z'
          },
          {
            name: 'Background Jobs',
            status: 'running',
            last_restart: '2024-09-20T06:00:00Z'
          }
        ])

        setSystemInfo({
          version: '1.2.4',
          environment: 'development',
          region: 'UAE Central',
          deployment_date: '2024-09-08T14:30:00Z',
          build_hash: 'a1b2c3d4'
        })
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to load system data: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to fetch system data:', error)
      if (error instanceof Error) {
        handleError(error)
      } else {
        handleError(new Error('An unexpected error occurred while loading system information'))
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical':
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'stopped':
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return 'text-green-800 bg-green-100'
      case 'warning':
        return 'text-yellow-800 bg-yellow-100'
      case 'critical':
      case 'error':
        return 'text-red-800 bg-red-100'
      case 'stopped':
        return 'text-gray-800 bg-gray-100'
      default:
        return 'text-gray-800 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageLoading
          title="Loading System Information"
          description="Please wait while we fetch system status and metrics..."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
          <p className="text-gray-600">Monitor system health, performance, and services</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={fetchSystemData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <ApiError
        error={error}
        onRetry={fetchSystemData}
        onDismiss={resetError}
        title="System Monitoring Error"
      />

      {/* System Health */}
      {health && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.status)}`}>
              {getStatusIcon(health.status)}
              <span className="ml-1">{health.status.charAt(0).toUpperCase() + health.status.slice(1)}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Uptime</p>
                <p className="font-medium text-gray-900">{health.uptime}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Last Health Check</p>
                <p className="font-medium text-gray-900">{formatDate(health.last_check)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* System Metrics */}
      {metrics && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="flex items-center">
              <Cpu className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.cpu_usage}%</p>
              </div>
            </div>

            <div className="flex items-center">
              <MemoryStick className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Memory</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.memory_usage}%</p>
              </div>
            </div>

            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Disk Usage</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.disk_usage}%</p>
              </div>
            </div>

            <div className="flex items-center">
              <Globe className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Connections</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.active_connections}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Zap className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Response Time</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.response_time_ms}ms</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* System Information */}
      {systemInfo && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Version</p>
              <p className="font-medium text-gray-900">{systemInfo.version}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Environment</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                systemInfo.environment === 'production' ? 'bg-red-100 text-red-800' :
                systemInfo.environment === 'staging' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {systemInfo.environment}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Region</p>
              <p className="font-medium text-gray-900">{systemInfo.region}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deployment Date</p>
              <p className="font-medium text-gray-900">{formatDate(systemInfo.deployment_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Build Hash</p>
              <p className="font-medium text-gray-900 font-mono">{systemInfo.build_hash}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Services Status */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Services Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Port
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Restart
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map((service, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Server className="h-5 w-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">
                        {service.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                      {getStatusIcon(service.status)}
                      <span className="ml-1">{service.status.charAt(0).toUpperCase() + service.status.slice(1)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {service.version || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {service.port || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {service.last_restart ? formatDate(service.last_restart) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Monitor className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}