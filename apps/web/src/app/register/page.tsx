'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import {
  Building,
  User,
  Mail,
  Lock,
  Check,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react'

interface RegistrationForm {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  organizationName: string
  jobTitle: string
  phone: string
  country: string
  acceptTerms: boolean
}

interface ValidationErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
  organizationName?: string
  acceptTerms?: string
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegistrationForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    jobTitle: '',
    phone: '',
    country: 'UAE',
    acceptTerms: false
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [step, setStep] = useState(1) // 1: User Info, 2: Organization Info, 3: Confirmation
  const router = useRouter()
  const supabase = createClient()

  const gccCountries = [
    'UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman'
  ]

  const validateStep1 = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep3 = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep3()) {
      return
    }

    setLoading(true)

    try {
      // 1. Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            organization_name: formData.organizationName,
            job_title: formData.jobTitle,
            phone: formData.phone,
            country: formData.country
          }
        }
      })

      if (authError) {
        throw authError
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      // 2. Create organization record
      const { data: orgData, error: orgError } = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session?.access_token}`
        },
        body: JSON.stringify({
          name: formData.organizationName,
          country: formData.country,
          subscription_tier: 'trial',
          settings: {
            default_language: 'en',
            business_hours: {
              start: '09:00',
              end: '17:00',
              timezone: formData.country === 'UAE' ? 'Asia/Dubai' : 'Asia/Riyadh'
            }
          }
        })
      }).then(res => res.json())

      if (orgError) {
        throw new Error('Failed to create organization')
      }

      // 3. Create user profile
      const { error: profileError } = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session?.access_token}`
        },
        body: JSON.stringify({
          user_id: authData.user.id,
          organization_id: orgData.organization.id,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: 'admin', // First user becomes admin
          job_title: formData.jobTitle,
          phone: formData.phone,
          country: formData.country,
          preferences: {
            language: 'en',
            notifications: {
              email: true,
              in_app: true
            }
          }
        })
      }).then(res => res.json())

      if (profileError) {
        throw new Error('Failed to create user profile')
      }

      // Success - redirect to dashboard
      router.push('/dashboard?welcome=true')

    } catch (error: any) {
      console.error('Registration error:', error)
      setErrors({
        email: error.message || 'Registration failed. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: keyof RegistrationForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const renderStep1 = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h2>
        <p className="text-gray-600">Enter your personal information to get started</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <Input
            value={formData.firstName}
            onChange={(e) => updateFormData('firstName', e.target.value)}
            placeholder="Enter your first name"
            error={errors.firstName}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <Input
            value={formData.lastName}
            onChange={(e) => updateFormData('lastName', e.target.value)}
            placeholder="Enter your last name"
            error={errors.lastName}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => updateFormData('email', e.target.value)}
          placeholder="Enter your business email"
          error={errors.email}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => updateFormData('password', e.target.value)}
            placeholder="Create a strong password"
            error={errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Must be at least 8 characters with uppercase, lowercase, and number
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <div className="relative">
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
            placeholder="Confirm your password"
            error={errors.confirmPassword}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full">
        Continue
      </Button>
    </form>
  )

  const renderStep2 = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Details</h2>
        <p className="text-gray-600">Tell us about your organization</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Organization Name
        </label>
        <Input
          value={formData.organizationName}
          onChange={(e) => updateFormData('organizationName', e.target.value)}
          placeholder="Enter your company or organization name"
          error={errors.organizationName}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Title
          </label>
          <Input
            value={formData.jobTitle}
            onChange={(e) => updateFormData('jobTitle', e.target.value)}
            placeholder="e.g., Collections Manager"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <Input
            value={formData.phone}
            onChange={(e) => updateFormData('phone', e.target.value)}
            placeholder="+971 50 123 4567"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country
        </label>
        <select
          value={formData.country}
          onChange={(e) => updateFormData('country', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {gccCountries.map(country => (
            <option key={country} value={country}>{country}</option>
          ))}
        </select>
      </div>

      <div className="flex space-x-3">
        <Button type="button" onClick={() => setStep(1)} variant="outline" className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Continue
        </Button>
      </div>
    </form>
  )

  const renderStep3 = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost Done!</h2>
        <p className="text-gray-600">Review your information and accept our terms</p>
      </div>

      <Card className="p-4 bg-gray-50">
        <div className="space-y-3">
          <div className="flex items-center">
            <User className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm">{formData.firstName} {formData.lastName}</span>
          </div>
          <div className="flex items-center">
            <Mail className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm">{formData.email}</span>
          </div>
          <div className="flex items-center">
            <Building className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm">{formData.organizationName}</span>
          </div>
          {formData.jobTitle && (
            <div className="flex items-center">
              <span className="text-sm text-gray-600 ml-6">{formData.jobTitle}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <label className="flex items-start space-x-2">
          <input
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={(e) => updateFormData('acceptTerms', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
          />
          <span className="text-sm text-gray-700">
            I agree to the{' '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700 underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-sm text-red-600">{errors.acceptTerms}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Check className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">Trial Period</h3>
            <p className="text-sm text-blue-700 mt-1">
              You'll get a 14-day free trial with full access to all features.
              No credit card required.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button type="button" onClick={() => setStep(2)} variant="outline" className="flex-1">
          Back
        </Button>
        <Button
          type="submit"
          disabled={loading || !formData.acceptTerms}
          className="flex-1"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Progress indicator */}
        <div className="flex justify-center space-x-4 mb-8">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i === step
                  ? 'bg-blue-600 text-white'
                  : i < step
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </Card>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  )
}