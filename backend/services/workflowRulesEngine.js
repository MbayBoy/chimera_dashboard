const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * WorkflowRulesEngine - evaluates rules whenever anomalies are detected or thresholds crossed.
 * Executes matching actions and logs to system_logs with source 'Workflow_Rule_Engine'.
 */
class WorkflowRulesEngine {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Evaluate all enabled rules against a given event context.
   * @param {Object} event - { type, severity, anomaly_type, server_id, campaign_id, value }
   */
  async evaluateRules(event) {
    try {
      const { data: rules, error } = await supabase?.from('workflow_rules')?.select('*')?.eq('enabled', true)?.order('priority', { ascending: false });

      if (error) throw error;
      if (!rules || rules?.length === 0) return;

      const matchingRules = rules?.filter(rule => this.matchesConditions(rule, event));

      for (const rule of matchingRules) {
        await this.executeAction(rule, event);
      }
    } catch (err) {
      logger?.error(`WorkflowRulesEngine evaluation error: ${err?.message}`);
    }
  }

  /**
   * Check if a rule's conditions match the event.
   */
  matchesConditions(rule, event) {
    const conditions = rule?.conditions || {};

    // Check trigger type match
    const triggerMap = {
      Anomaly_Detected: ['Anomaly_Detection', 'anomaly'],
      Server_Reputation_Drop: ['Reputation_Drop', 'reputation'],
      Bounce_Rate_Spike: ['Bounce_Spike', 'bounce'],
      Cost_Exceeds_Budget: ['Cost_Overrun', 'cost'],
      Campaign_Failure_Rate_High: ['Campaign_Failure', 'campaign_failure'],
    };

    const validTypes = triggerMap?.[rule?.trigger_type] || [];
    if (!validTypes?.some(t => event?.type?.includes(t))) return false;

    // Check severity filter
    if (conditions?.severity && conditions?.severity !== event?.severity) return false;

    // Check anomaly type filter
    if (conditions?.anomaly_type && conditions?.anomaly_type !== event?.anomaly_type) return false;

    // Check threshold
    if (conditions?.threshold && event?.value !== undefined) {
      try {
        const thresholdStr = conditions?.threshold?.replace(/[a-zA-Z_]+\s*/, '');
        const match = thresholdStr?.match(/([<>=!]+)\s*(\d+\.?\d*)/);
        if (match) {
          const [, op, val] = match;
          const numVal = parseFloat(val);
          if (op === '<' && !(event?.value < numVal)) return false;
          if (op === '>' && !(event?.value > numVal)) return false;
          if (op === '<=' && !(event?.value <= numVal)) return false;
          if (op === '>=' && !(event?.value >= numVal)) return false;
          if (op === '==' && !(event?.value === numVal)) return false;
        }
      } catch (e) {
        // Threshold parse error — skip threshold check
      }
    }

    return true;
  }

  /**
   * Execute the rule's action and log to system_logs.
   */
  async executeAction(rule, event) {
    const action = rule?.actions || {};
    const actionType = action?.action_type;
    const params = action?.params || {};

    logger?.info(`WorkflowRulesEngine: Executing rule "${rule?.name}" (${actionType}) for event ${event?.type}`);

    try {
      switch (actionType) {
        case 'Quarantine_Server':
          if (event?.server_id || params?.server_id) {
            await supabase?.from('servers')?.update({ server_status: 'Quarantined' })?.eq('id', event?.server_id || params?.server_id);
          }
          break;

        case 'Pause_Campaign':
          if (event?.campaign_id || params?.campaign_id) {
            await supabase?.from('campaigns')?.update({ campaign_status: 'Paused' })?.eq('id', event?.campaign_id || params?.campaign_id);
          }
          break;

        case 'Send_Alert_to_Admin':
          // Alert is logged to system_logs below
          break;

        case 'Execute_Cost_Optimization':
          // Log cost optimization trigger
          break;

        case 'Auto_Clean_Contacts': case'Trigger_List_Verification':
          // Log verification trigger
          break;

        default:
          logger?.warn(`WorkflowRulesEngine: Unknown action type: ${actionType}`);
      }

      // Log execution to system_logs
      await supabase?.from('system_logs')?.insert({
        log_level: 'INFO',
        source: 'Workflow_Rule_Engine',
        message: `Rule "${rule?.name}" triggered: ${actionType} executed for ${event?.type} event`,
        log_timestamp: new Date()?.toISOString(),
        server_id: event?.server_id || null,
        related_campaign_id: event?.campaign_id || null,
        metadata: {
          rule_id: rule?.id,
          rule_name: rule?.name,
          action_type: actionType,
          trigger_event: event,
          params,
        },
      });

      // Update rule trigger count and last_triggered_at
      await supabase?.from('workflow_rules')?.update({
          trigger_count: (rule?.trigger_count || 0) + 1,
          last_triggered_at: new Date()?.toISOString(),
        })?.eq('id', rule?.id);

    } catch (err) {
      logger?.error(`WorkflowRulesEngine: Action execution failed for rule "${rule?.name}": ${err?.message}`);

      await supabase?.from('system_logs')?.insert({
        log_level: 'ERROR',
        source: 'Workflow_Rule_Engine',
        message: `Rule "${rule?.name}" action failed: ${err?.message}`,
        log_timestamp: new Date()?.toISOString(),
        metadata: { rule_id: rule?.id, action_type: actionType, error: err?.message },
      })?.catch(() => {});
    }
  }
}

module.exports = new WorkflowRulesEngine();
