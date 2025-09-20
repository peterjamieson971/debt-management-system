import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { getCommunicationPrompt, buildCommunicationContext, interpolateTemplate } from '@/lib/ai/prompts'

export interface WorkflowStep {
  id: string
  type: 'communication' | 'wait' | 'condition' | 'escalation' | 'action'
  name: string
  config: Record<string, any>
  delay_days?: number
  conditions?: WorkflowCondition[]
}

export interface WorkflowCondition {
  field: string
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_equals'
  value: any
}

export interface DebtCollectionWorkflow {
  id: string
  name: string
  description: string
  trigger_conditions: WorkflowCondition[]
  steps: WorkflowStep[]
  settings: {
    max_escalation_level: number
    auto_stop_on_payment: boolean
    respect_holidays: boolean
    business_days_only: boolean
  }
}

export class WorkflowEngine {
  private supabase: any

  constructor() {
    this.supabase = null
  }

  async initialize() {
    this.supabase = await createServiceClient()
  }

  // Execute workflow for a specific case
  async executeWorkflow(caseId: string, workflowId?: string): Promise<any> {
    if (!this.supabase) await this.initialize()

    // Get case details
    const { data: collectionCase, error } = await this.supabase
      .from('collection_cases')
      .select(`
        *,
        debtors!inner(*),
        communication_logs(*)
      `)
      .eq('id', caseId)
      .single()

    if (error || !collectionCase) {
      throw new Error(`Case not found: ${caseId}`)
    }

    // Determine appropriate workflow
    const workflow = workflowId ?
      await this.getWorkflow(workflowId) :
      await this.selectOptimalWorkflow(collectionCase)

    if (!workflow) {
      throw new Error('No suitable workflow found')
    }

    // Execute workflow steps
    return await this.processWorkflowSteps(collectionCase, workflow)
  }

  // Get default workflows based on case characteristics
  private async selectOptimalWorkflow(caseData: any): Promise<DebtCollectionWorkflow> {
    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Select workflow based on case characteristics
    if (daysOverdue <= 30 && caseData.priority !== 'critical') {
      return this.getStandardWorkflow()
    } else if (daysOverdue > 30 || caseData.priority === 'high') {
      return this.getEscalatedWorkflow()
    } else if (caseData.priority === 'critical') {
      return this.getUrgentWorkflow()
    }

    return this.getStandardWorkflow()
  }

  // Process individual workflow steps
  private async processWorkflowSteps(caseData: any, workflow: DebtCollectionWorkflow): Promise<any> {
    const results = []

    for (const step of workflow.steps) {
      // Check conditions before executing step
      if (step.conditions && !this.evaluateConditions(step.conditions, caseData)) {
        console.log(`Skipping step ${step.id} - conditions not met`)
        continue
      }

      try {
        const result = await this.executeStep(step, caseData, workflow)
        results.push({
          step_id: step.id,
          step_name: step.name,
          result,
          executed_at: new Date().toISOString()
        })

        // Check if we should stop (e.g., payment received)
        if (workflow.settings.auto_stop_on_payment && caseData.status === 'resolved') {
          console.log('Workflow stopped - case resolved')
          break
        }

      } catch (error) {
        console.error(`Error executing step ${step.id}:`, error)
        results.push({
          step_id: step.id,
          step_name: step.name,
          error: error.message,
          executed_at: new Date().toISOString()
        })
      }
    }

    // Log workflow execution
    await this.supabase.from('workflow_executions').insert({
      organization_id: caseData.organization_id,
      case_id: caseData.id,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      steps_executed: results.length,
      status: 'completed',
      results,
      executed_at: new Date().toISOString()
    })

    return {
      workflow_id: workflow.id,
      case_id: caseData.id,
      steps_executed: results.length,
      results
    }
  }

  // Execute individual workflow step
  private async executeStep(step: WorkflowStep, caseData: any, workflow: DebtCollectionWorkflow): Promise<any> {
    switch (step.type) {
      case 'communication':
        return await this.executeCommunicationStep(step, caseData)

      case 'wait':
        return await this.executeWaitStep(step, caseData)

      case 'escalation':
        return await this.executeEscalationStep(step, caseData)

      case 'action':
        return await this.executeActionStep(step, caseData)

      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  // Execute communication step (generate and queue email)
  private async executeCommunicationStep(step: WorkflowStep, caseData: any): Promise<any> {
    const { communication_type, channel = 'email', language, tone = 'professional' } = step.config

    // Build context for AI generation
    const context = buildCommunicationContext(caseData, caseData.debtors, communication_type)

    // Get appropriate prompt
    const prompt = getCommunicationPrompt(communication_type, language || caseData.debtors.language_preference)
    const interpolatedPrompt = interpolateTemplate(prompt, context)

    // Generate content using AI
    const aiResult = await generateWithSmartRouting(
      communication_type === 'escalation' || communication_type === 'final_notice' ? 'complex' : 'simple',
      interpolatedPrompt,
      { case: caseData, debtor: caseData.debtors },
      { language: language || caseData.debtors.language_preference, tone }
    )

    let generatedContent = {}
    try {
      generatedContent = JSON.parse(aiResult.content)
    } catch (error) {
      throw new Error('Failed to parse AI-generated content')
    }

    // Create communication log entry
    const zapierTaskId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: communicationLog, error } = await this.supabase
      .from('communication_logs')
      .insert({
        organization_id: caseData.organization_id,
        case_id: caseData.id,
        debtor_id: caseData.debtor_id,
        channel,
        direction: 'outbound',
        status: 'queued',
        subject: (generatedContent as any).subject,
        content: (generatedContent as any).content,
        ai_generated: true,
        zapier_task_id: zapierTaskId,
        scheduled_send_at: new Date().toISOString(),
        metadata: {
          workflow_step_id: step.id,
          communication_type,
          tone,
          language: language || caseData.debtors.language_preference,
          ai_model: aiResult.model,
          generated_content: generatedContent
        }
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create communication log: ${error.message}`)
    }

    // Log AI interaction for cost tracking
    await this.supabase.from('ai_interactions').insert({
      organization_id: caseData.organization_id,
      case_id: caseData.id,
      interaction_type: 'workflow_communication',
      model_used: aiResult.model,
      prompt_tokens: aiResult.usage?.prompt_tokens || 0,
      completion_tokens: aiResult.usage?.completion_tokens || 0,
      total_tokens: aiResult.usage?.total_tokens || 0,
      cost_usd: aiResult.cost || 0,
      metadata: {
        workflow_step_id: step.id,
        communication_type,
        channel,
        language: language || caseData.debtors.language_preference
      }
    })

    return {
      communication_id: communicationLog.id,
      zapier_task_id: zapierTaskId,
      ai_cost: aiResult.cost,
      content_generated: true
    }
  }

  // Execute wait step (schedule next action)
  private async executeWaitStep(step: WorkflowStep, caseData: any): Promise<any> {
    const { delay_days = 7 } = step.config

    const nextActionDate = new Date()
    nextActionDate.setDate(nextActionDate.getDate() + delay_days)

    // Update case with next action date
    await this.supabase
      .from('collection_cases')
      .update({
        next_action_due: nextActionDate.toISOString()
      })
      .eq('id', caseData.id)

    return {
      delay_days,
      next_action_due: nextActionDate.toISOString()
    }
  }

  // Execute escalation step
  private async executeEscalationStep(step: WorkflowStep, caseData: any): Promise<any> {
    const { escalation_level, assign_to, priority } = step.config

    const updates: any = {}

    if (escalation_level !== undefined) {
      updates.current_stage = escalation_level
    }

    if (assign_to) {
      updates.assigned_to = assign_to
    }

    if (priority) {
      updates.priority = priority
    }

    await this.supabase
      .from('collection_cases')
      .update(updates)
      .eq('id', caseData.id)

    // Log escalation event
    await this.supabase.from('analytics_events').insert({
      organization_id: caseData.organization_id,
      event_type: 'case_escalated',
      entity_type: 'collection_case',
      entity_id: caseData.id,
      properties: {
        previous_stage: caseData.current_stage,
        new_stage: escalation_level,
        escalated_by: 'workflow',
        reason: step.name
      }
    })

    return updates
  }

  // Execute action step (custom actions)
  private async executeActionStep(step: WorkflowStep, caseData: any): Promise<any> {
    const { action_type } = step.config

    switch (action_type) {
      case 'update_risk_profile':
        return await this.updateRiskProfile(caseData, step.config)

      case 'notify_manager':
        return await this.notifyManager(caseData, step.config)

      case 'generate_report':
        return await this.generateReport(caseData, step.config)

      default:
        throw new Error(`Unknown action type: ${action_type}`)
    }
  }

  // Helper methods for actions
  private async updateRiskProfile(caseData: any, config: any): Promise<any> {
    const { new_risk_level } = config

    await this.supabase
      .from('debtors')
      .update({ risk_profile: new_risk_level })
      .eq('id', caseData.debtor_id)

    return { updated_risk_profile: new_risk_level }
  }

  private async notifyManager(caseData: any, config: any): Promise<any> {
    const { manager_id, message } = config

    // Create internal notification
    await this.supabase.from('notifications').insert({
      organization_id: caseData.organization_id,
      user_id: manager_id,
      type: 'workflow_notification',
      title: 'Case Requires Attention',
      message: message || `Case ${caseData.id} requires management review`,
      metadata: {
        case_id: caseData.id,
        debtor_id: caseData.debtor_id,
        workflow_triggered: true
      }
    })

    return { manager_notified: true, manager_id }
  }

  private async generateReport(caseData: any, config: any): Promise<any> {
    // Generate case report - implementation would depend on requirements
    return { report_generated: true, report_type: config.report_type }
  }

  // Evaluate workflow conditions
  private evaluateConditions(conditions: WorkflowCondition[], caseData: any): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(condition.field, caseData)

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value
        case 'not_equals':
          return fieldValue !== condition.value
        case 'greater_than':
          return fieldValue > condition.value
        case 'less_than':
          return fieldValue < condition.value
        case 'contains':
          return String(fieldValue).includes(condition.value)
        default:
          return false
      }
    })
  }

  private getFieldValue(field: string, caseData: any): any {
    const fields = field.split('.')
    let value = caseData

    for (const f of fields) {
      value = value?.[f]
    }

    return value
  }

  // Get workflow by ID (placeholder - in real implementation, these would be stored in database)
  private async getWorkflow(workflowId: string): Promise<DebtCollectionWorkflow | null> {
    const workflows = {
      'standard': this.getStandardWorkflow(),
      'escalated': this.getEscalatedWorkflow(),
      'urgent': this.getUrgentWorkflow()
    }

    return workflows[workflowId as keyof typeof workflows] || null
  }

  // Predefined workflow templates
  private getStandardWorkflow(): DebtCollectionWorkflow {
    return {
      id: 'standard',
      name: 'Standard Collection Workflow',
      description: 'Standard debt collection process for regular cases',
      trigger_conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'outstanding_amount', operator: 'greater_than', value: 0 }
      ],
      steps: [
        {
          id: 'initial_notice',
          type: 'communication',
          name: 'Send Initial Notice',
          config: {
            communication_type: 'initial_notice',
            channel: 'email',
            tone: 'professional'
          }
        },
        {
          id: 'wait_7_days',
          type: 'wait',
          name: 'Wait 7 Days',
          config: { delay_days: 7 }
        },
        {
          id: 'first_reminder',
          type: 'communication',
          name: 'Send First Reminder',
          config: {
            communication_type: 'reminder',
            channel: 'email',
            tone: 'professional'
          },
          conditions: [
            { field: 'status', operator: 'not_equals', value: 'resolved' }
          ]
        },
        {
          id: 'wait_5_days',
          type: 'wait',
          name: 'Wait 5 Days',
          config: { delay_days: 5 }
        },
        {
          id: 'escalation_notice',
          type: 'communication',
          name: 'Send Escalation Notice',
          config: {
            communication_type: 'escalation',
            channel: 'email',
            tone: 'firm'
          },
          conditions: [
            { field: 'status', operator: 'not_equals', value: 'resolved' }
          ]
        }
      ],
      settings: {
        max_escalation_level: 3,
        auto_stop_on_payment: true,
        respect_holidays: true,
        business_days_only: true
      }
    }
  }

  private getEscalatedWorkflow(): DebtCollectionWorkflow {
    return {
      id: 'escalated',
      name: 'Escalated Collection Workflow',
      description: 'Accelerated workflow for overdue cases',
      trigger_conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'priority', operator: 'equals', value: 'high' }
      ],
      steps: [
        {
          id: 'urgent_notice',
          type: 'communication',
          name: 'Send Urgent Notice',
          config: {
            communication_type: 'escalation',
            channel: 'email',
            tone: 'firm'
          }
        },
        {
          id: 'escalate_case',
          type: 'escalation',
          name: 'Escalate Case',
          config: {
            escalation_level: 2,
            priority: 'critical'
          }
        },
        {
          id: 'wait_3_days',
          type: 'wait',
          name: 'Wait 3 Days',
          config: { delay_days: 3 }
        },
        {
          id: 'final_notice',
          type: 'communication',
          name: 'Send Final Notice',
          config: {
            communication_type: 'final_notice',
            channel: 'email',
            tone: 'urgent'
          },
          conditions: [
            { field: 'status', operator: 'not_equals', value: 'resolved' }
          ]
        }
      ],
      settings: {
        max_escalation_level: 5,
        auto_stop_on_payment: true,
        respect_holidays: false,
        business_days_only: false
      }
    }
  }

  private getUrgentWorkflow(): DebtCollectionWorkflow {
    return {
      id: 'urgent',
      name: 'Urgent Collection Workflow',
      description: 'Immediate action workflow for critical cases',
      trigger_conditions: [
        { field: 'priority', operator: 'equals', value: 'critical' }
      ],
      steps: [
        {
          id: 'immediate_escalation',
          type: 'escalation',
          name: 'Immediate Escalation',
          config: {
            escalation_level: 4,
            priority: 'critical'
          }
        },
        {
          id: 'urgent_communication',
          type: 'communication',
          name: 'Send Urgent Notice',
          config: {
            communication_type: 'final_notice',
            channel: 'email',
            tone: 'urgent'
          }
        },
        {
          id: 'notify_management',
          type: 'action',
          name: 'Notify Management',
          config: {
            action_type: 'notify_manager',
            message: 'Critical case requires immediate attention'
          }
        }
      ],
      settings: {
        max_escalation_level: 5,
        auto_stop_on_payment: true,
        respect_holidays: false,
        business_days_only: false
      }
    }
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine()