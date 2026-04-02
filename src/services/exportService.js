import jsPDF from 'jspdf';
import Papa from 'papaparse';

const SYSTEM_VERSION = '1.0.0';

// ============================================================
// CSV EXPORT
// ============================================================
export const exportCSV = (data, filename) => {
  const csv = Papa?.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link?.setAttribute('download', filename);
  document.body?.appendChild(link);
  link?.click();
  document.body?.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================================
// PDF HELPERS
// ============================================================
const addPDFHeader = (doc, title, subtitle, generatedBy) => {
  const pageW = doc?.internal?.pageSize?.getWidth();
  // Header background
  doc?.setFillColor(15, 23, 42); // slate-950
  doc?.rect(0, 0, pageW, 40, 'F');
  // Title
  doc?.setTextColor(255, 255, 255);
  doc?.setFontSize(18);
  doc?.setFont('helvetica', 'bold');
  doc?.text('CHIMERA', 14, 16);
  doc?.setFontSize(10);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(148, 163, 184); // slate-400
  doc?.text('Email Deliverability Intelligence Platform', 14, 24);
  // Report title on right
  doc?.setTextColor(255, 255, 255);
  doc?.setFontSize(12);
  doc?.setFont('helvetica', 'bold');
  doc?.text(title, pageW - 14, 16, { align: 'right' });
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(148, 163, 184);
  doc?.text(subtitle, pageW - 14, 24, { align: 'right' });
  // Metadata bar
  doc?.setFillColor(30, 41, 59); // slate-800
  doc?.rect(0, 40, pageW, 14, 'F');
  doc?.setTextColor(148, 163, 184);
  doc?.setFontSize(7);
  const now = new Date();
  doc?.text(`Generated: ${now?.toLocaleString()}`, 14, 49);
  doc?.text(`By: ${generatedBy || 'System'}`, pageW / 2, 49, { align: 'center' });
  doc?.text(`Version: ${SYSTEM_VERSION}`, pageW - 14, 49, { align: 'right' });
  return 62; // y position after header
};

const addSection = (doc, title, y, pageW) => {
  doc?.setFillColor(30, 41, 59);
  doc?.rect(0, y, pageW, 10, 'F');
  doc?.setTextColor(99, 179, 237); // blue-300
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'bold');
  doc?.text(title?.toUpperCase(), 14, y + 7);
  return y + 16;
};

const addTable = (doc, headers, rows, y, pageW) => {
  const colW = (pageW - 28) / headers?.length;
  // Header row
  doc?.setFillColor(51, 65, 85);
  doc?.rect(14, y, pageW - 28, 8, 'F');
  doc?.setTextColor(255, 255, 255);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  headers?.forEach((h, i) => doc?.text(String(h), 16 + i * colW, y + 5.5));
  y += 8;
  // Data rows
  doc?.setFont('helvetica', 'normal');
  rows?.forEach((row, ri) => {
    if (y > doc?.internal?.pageSize?.getHeight() - 20) {
      doc?.addPage();
      y = 20;
    }
    doc?.setFillColor(ri % 2 === 0 ? 15 : 22, ri % 2 === 0 ? 23 : 30, ri % 2 === 0 ? 42 : 50);
    doc?.rect(14, y, pageW - 28, 7, 'F');
    doc?.setTextColor(203, 213, 225);
    row?.forEach((cell, ci) => {
      const text = String(cell ?? '—')?.substring(0, 30);
      doc?.text(text, 16 + ci * colW, y + 5);
    });
    y += 7;
  });
  return y + 4;
};

const addStatCard = (doc, label, value, x, y, w = 40, h = 18) => {
  doc?.setFillColor(30, 41, 59);
  doc?.roundedRect(x, y, w, h, 2, 2, 'F');
  doc?.setTextColor(148, 163, 184);
  doc?.setFontSize(6.5);
  doc?.setFont('helvetica', 'normal');
  doc?.text(label, x + 3, y + 6);
  doc?.setTextColor(255, 255, 255);
  doc?.setFontSize(11);
  doc?.setFont('helvetica', 'bold');
  doc?.text(String(value), x + 3, y + 14);
};

// ============================================================
// WAR ROOM PDF EXPORT
// ============================================================
export const exportWarRoomPDF = ({ fleetData, fleetStats, threatEvents, goldenListData, generatedBy, dateRange }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  let y = addPDFHeader(doc, 'War Room Report', dateRange || 'All Time', generatedBy);

  // Fleet Stats
  y = addSection(doc, 'Fleet Overview', y, pageW);
  const stats = [
    ['Fleet Reputation', `${fleetStats?.avgReputation || 0}/100`],
    ['Active Servers', fleetStats?.statusCounts?.Active || 0],
    ['Quarantined', fleetStats?.statusCounts?.Quarantined || 0],
    ['Sent Today', (fleetStats?.totalCampaignsSentToday || 0)?.toLocaleString()],
    ['Deliverability', fleetStats?.avgDeliverability > 0 ? `${fleetStats?.avgDeliverability}%` : 'N/A'],
    ['Total Servers', fleetStats?.totalServers || 0],
  ];
  const cardW = (pageW - 28) / stats?.length;
  stats?.forEach(([label, value], i) => addStatCard(doc, label, value, 14 + i * cardW, y, cardW - 2, 18));
  y += 24;

  // Server List
  y = addSection(doc, 'Server Fleet Status', y, pageW);
  const serverHeaders = ['Server Name', 'IP Address', 'Status', 'Purpose', 'Reputation', 'Sent Today', 'Daily Limit', 'Blacklists'];
  const serverRows = (fleetData || [])?.map(s => [
    s?.name, s?.ip, s?.status, s?.purpose,
    `${s?.reputation || s?.reputationScore || 0}/100`,
    (s?.sentToday || 0)?.toLocaleString(),
    (s?.dailyLimit || 0)?.toLocaleString(),
    s?.blacklistCount || 0,
  ]);
  y = addTable(doc, serverHeaders, serverRows, y, pageW);

  // Alert Feed
  if (y > doc?.internal?.pageSize?.getHeight() - 60) { doc?.addPage(); y = 20; }
  y = addSection(doc, 'Alert Feed (system_logs)', y, pageW);
  const alertHeaders = ['Timestamp', 'Severity', 'Source', 'Message', 'Action'];
  const alertRows = (threatEvents || [])?.slice(0, 50)?.map(e => [
    new Date(e?.timestamp)?.toLocaleString(),
    e?.severity,
    e?.type || e?.source,
    (e?.message || '')?.substring(0, 60),
    e?.action || '—',
  ]);
  y = addTable(doc, alertHeaders, alertRows, y, pageW);

  // Golden List
  if (goldenListData && y < doc?.internal?.pageSize?.getHeight() - 40) {
    y = addSection(doc, 'Golden List Health', y, pageW);
    const tierHeaders = ['Tier', 'Count', 'Percentage', 'Engagement Score'];
    const tierRows = Object.entries(goldenListData?.tiers || {})?.map(([tier, data]) => [
      tier?.charAt(0)?.toUpperCase() + tier?.slice(1),
      data?.count || 0,
      `${data?.percentage || 0}%`,
      `${data?.engagementScore || 0}/100`,
    ]);
    y = addTable(doc, tierHeaders, tierRows, y, pageW);
  }

  doc?.save(`war-room-report-${new Date()?.toISOString()?.split('T')?.[0]}.pdf`);
};

export const exportWarRoomCSV = ({ fleetData, threatEvents, goldenListData }) => {
  const timestamp = new Date()?.toISOString();
  // Servers sheet
  exportCSV(
    (fleetData || [])?.map(s => ({
      report_generated: timestamp,
      server_name: s?.name,
      ip_address: s?.ip,
      status: s?.status,
      purpose: s?.purpose,
      reputation_score: s?.reputation || s?.reputationScore || 0,
      sent_today: s?.sentToday || 0,
      daily_limit: s?.dailyLimit || 0,
      blacklist_count: s?.blacklistCount || 0,
      has_critical_blacklist: s?.hasCriticalBlacklist || false,
    })),
    `war-room-servers-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
  );
  // Alerts sheet
  setTimeout(() => {
    exportCSV(
      (threatEvents || [])?.map(e => ({
        report_generated: timestamp,
        timestamp: new Date(e?.timestamp)?.toISOString(),
        severity: e?.severity,
        source: e?.type || e?.source,
        message: e?.message,
        server_id: e?.serverId || '',
        action: e?.action || '',
      })),
      `war-room-alerts-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
    );
  }, 500);
};

// ============================================================
// ANOMALY DETECTION PDF EXPORT
// ============================================================
export const exportAnomalyPDF = ({ anomalies, generatedBy, dateRange }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  let y = addPDFHeader(doc, 'Anomaly Detection Report', dateRange || 'All Time', generatedBy);

  // Summary stats
  y = addSection(doc, 'Anomaly Summary', y, pageW);
  const active = (anomalies || [])?.filter(a => !a?.isResolved);
  const critical = active?.filter(a => a?.severity === 'Critical')?.length;
  const high = active?.filter(a => a?.severity === 'High')?.length;
  const resolved = (anomalies || [])?.filter(a => a?.isResolved)?.length;
  const summaryStats = [
    ['Total Anomalies', anomalies?.length || 0],
    ['Active', active?.length],
    ['Critical', critical],
    ['High', high],
    ['Resolved', resolved],
    ['Resolution Rate', anomalies?.length ? `${Math.round((resolved / anomalies?.length) * 100)}%` : '0%'],
  ];
  const cardW = (pageW - 28) / summaryStats?.length;
  summaryStats?.forEach(([label, value], i) => addStatCard(doc, label, value, 14 + i * cardW, y, cardW - 2, 18));
  y += 24;

  // Anomaly grid
  y = addSection(doc, 'Anomaly Details', y, pageW);
  const headers = ['Detected At', 'Type', 'Severity', 'Title', 'Affected Entity', 'Metric', 'Baseline', 'Deviation', 'Status', 'Remediation'];
  const rows = (anomalies || [])?.map(a => [
    new Date(a?.detectedAt)?.toLocaleString(),
    a?.type,
    a?.severity,
    (a?.title || '')?.substring(0, 30),
    a?.affectedEntity || '—',
    a?.metricValue ?? '—',
    a?.baselineValue ?? '—',
    a?.deviationPercent ? `${a?.deviationPercent}%` : '—',
    a?.isResolved ? 'Resolved' : 'Active',
    (a?.remediationAction || '—')?.substring(0, 30),
  ]);
  y = addTable(doc, headers, rows, y, pageW);

  doc?.save(`anomaly-report-${new Date()?.toISOString()?.split('T')?.[0]}.pdf`);
};

export const exportAnomalyCSV = ({ anomalies }) => {
  const timestamp = new Date()?.toISOString();
  exportCSV(
    (anomalies || [])?.map(a => ({
      report_generated: timestamp,
      detected_at: a?.detectedAt,
      anomaly_type: a?.type,
      severity: a?.severity,
      title: a?.title,
      description: a?.description,
      affected_entity: a?.affectedEntity,
      metric_value: a?.metricValue,
      baseline_value: a?.baselineValue,
      deviation_percent: a?.deviationPercent,
      is_resolved: a?.isResolved,
      remediation_action: a?.remediationAction,
      resolved_at: a?.resolvedAt,
    })),
    `anomaly-report-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
  );
};

// ============================================================
// SERVER AUTOPSY PDF EXPORT
// ============================================================
export const exportAutopsyPDF = ({ autopsyData, serverData, generatedBy }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  let y = addPDFHeader(doc, 'Server Autopsy Report', serverData?.name || 'Unknown Server', generatedBy);

  // Server info
  y = addSection(doc, 'Server Information', y, pageW);
  const infoStats = [
    ['Server Name', serverData?.name || '—'],
    ['IP Address', serverData?.ip || '—'],
    ['Status', serverData?.status || '—'],
    ['Reputation', `${serverData?.reputation || 0}/100`],
    ['Purpose', serverData?.purpose || '—'],
    ['Blacklists', serverData?.blacklistCount || 0],
  ];
  const cardW = (pageW - 28) / 3;
  infoStats?.forEach(([label, value], i) => addStatCard(doc, label, value, 14 + (i % 3) * (cardW + 1), y + Math.floor(i / 3) * 22, cardW - 1, 18));
  y += 48;

  // Timeline
  y = addSection(doc, 'Event Timeline', y, pageW);
  const timelineHeaders = ['Timestamp', 'Event Type', 'Severity', 'Title', 'Description'];
  const timelineRows = (autopsyData?.timeline || [])?.slice(0, 50)?.map(e => [
    new Date(e?.timestamp)?.toLocaleString(),
    e?.event_type || e?.type,
    e?.severity,
    (e?.title || '')?.substring(0, 25),
    (e?.description || '')?.substring(0, 40),
  ]);
  y = addTable(doc, timelineHeaders, timelineRows, y, pageW);

  // Blacklist history
  if (autopsyData?.blacklist_history?.length > 0) {
    if (y > doc?.internal?.pageSize?.getHeight() - 50) { doc?.addPage(); y = 20; }
    y = addSection(doc, 'Blacklist History', y, pageW);
    const blHeaders = ['Blacklist', 'Listed At', 'Removed At', 'Status'];
    const blRows = autopsyData?.blacklist_history?.map(b => [
      b?.blacklist || b?.rbl || '—',
      b?.listed_at ? new Date(b.listed_at)?.toLocaleString() : '—',
      b?.removed_at ? new Date(b.removed_at)?.toLocaleString() : 'Still Listed',
      b?.removed_at ? 'Removed' : 'Active',
    ]);
    y = addTable(doc, blHeaders, blRows, y, pageW);
  }

  // Reputation trajectory
  if (autopsyData?.reputation_trajectory?.length > 0) {
    if (y > doc?.internal?.pageSize?.getHeight() - 50) { doc?.addPage(); y = 20; }
    y = addSection(doc, 'Reputation Trajectory (30 Days)', y, pageW);
    const repHeaders = ['Date', 'Reputation Score', 'Trend'];
    const repRows = autopsyData?.reputation_trajectory?.map(r => [
      r?.date || r?.day,
      r?.score || r?.reputation_score || '—',
      r?.trend || '—',
    ]);
    y = addTable(doc, repHeaders, repRows, y, pageW);
  }

  // Rehabilitation progress
  if (autopsyData?.rehabilitation_progress) {
    if (y > doc?.internal?.pageSize?.getHeight() - 50) { doc?.addPage(); y = 20; }
    y = addSection(doc, 'Rehabilitation Progress', y, pageW);
    const rehab = autopsyData?.rehabilitation_progress;
    const rehabStats = [
      ['Days in Quarantine', rehab?.days_in_quarantine || 0],
      ['Current Step', `${rehab?.current_step || 0}/7`],
      ['Test Sends Done', rehab?.test_sends_completed || 0],
      ['Deliverability', rehab?.deliverability_rate_7d ? `${rehab?.deliverability_rate_7d}%` : '—'],
      ['Zero Complaints', rehab?.zero_complaints_7d ? 'Yes' : 'No'],
      ['Ready to Promote', rehab?.ready_for_promotion ? 'Yes' : 'No'],
    ];
    const rCardW = (pageW - 28) / 3;
    rehabStats?.forEach(([label, value], i) => addStatCard(doc, label, value, 14 + (i % 3) * (rCardW + 1), y + Math.floor(i / 3) * 22, rCardW - 1, 18));
    y += 48;
  }

  doc?.save(`server-autopsy-${serverData?.name || 'unknown'}-${new Date()?.toISOString()?.split('T')?.[0]}.pdf`);
};

export const exportAutopsyCSV = ({ autopsyData, serverData }) => {
  const timestamp = new Date()?.toISOString();
  // Timeline CSV
  exportCSV(
    (autopsyData?.timeline || [])?.map(e => ({
      report_generated: timestamp,
      server_name: serverData?.name,
      server_ip: serverData?.ip,
      event_timestamp: e?.timestamp,
      event_type: e?.event_type || e?.type,
      severity: e?.severity,
      title: e?.title,
      description: e?.description,
      source: e?.source,
      automated: e?.automated,
    })),
    `server-autopsy-timeline-${serverData?.name || 'unknown'}-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
  );
  // Blacklist history CSV
  if (autopsyData?.blacklist_history?.length > 0) {
    setTimeout(() => {
      exportCSV(
        autopsyData?.blacklist_history?.map(b => ({
          report_generated: timestamp,
          server_name: serverData?.name,
          blacklist: b?.blacklist || b?.rbl,
          listed_at: b?.listed_at,
          removed_at: b?.removed_at || 'Still Listed',
          status: b?.removed_at ? 'Removed' : 'Active',
        })),
        `server-autopsy-blacklists-${serverData?.name || 'unknown'}-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
      );
    }, 500);
  }
};

// ============================================================
// DEVELOPER DOCUMENTATION PDF EXPORT
// ============================================================
export const exportDeveloperDocsPDF = () => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  const pageH = doc?.internal?.pageSize?.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const checkPageBreak = (y, needed = 20) => {
    if (y + needed > pageH - 15) {
      doc?.addPage();
      return 20;
    }
    return y;
  };

  const addDocHeader = (y) => {
    doc?.setFillColor(15, 23, 42);
    doc?.rect(0, 0, pageW, 44, 'F');
    doc?.setTextColor(255, 255, 255);
    doc?.setFontSize(22);
    doc?.setFont('helvetica', 'bold');
    doc?.text('CHIMERA', margin, 18);
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.setTextColor(148, 163, 184);
    doc?.text('Email Fleet Management Platform', margin, 26);
    doc?.setTextColor(99, 179, 237);
    doc?.setFontSize(13);
    doc?.setFont('helvetica', 'bold');
    doc?.text('Developer Documentation v5.0', margin, 36);
    doc?.setFillColor(30, 41, 59);
    doc?.rect(0, 44, pageW, 12, 'F');
    doc?.setTextColor(148, 163, 184);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Generated: ${new Date()?.toLocaleString()}`, margin, 51);
    doc?.text('Confidential — Internal Use Only', pageW - margin, 51, { align: 'right' });
    return 64;
  };

  const addHeading = (text, y, level = 1) => {
    y = checkPageBreak(y, 14);
    if (level === 1) {
      doc?.setFillColor(30, 41, 59);
      doc?.rect(0, y - 2, pageW, 11, 'F');
      doc?.setTextColor(99, 179, 237);
      doc?.setFontSize(10);
      doc?.setFont('helvetica', 'bold');
      doc?.text(text?.toUpperCase(), margin, y + 6);
      return y + 16;
    } else {
      doc?.setTextColor(226, 232, 240);
      doc?.setFontSize(9);
      doc?.setFont('helvetica', 'bold');
      doc?.text(text, margin, y);
      doc?.setDrawColor(51, 65, 85);
      doc?.line(margin, y + 1.5, pageW - margin, y + 1.5);
      return y + 8;
    }
  };

  const addText = (text, y, indent = 0, color = [203, 213, 225]) => {
    y = checkPageBreak(y, 8);
    doc?.setTextColor(...color);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'normal');
    const lines = doc?.splitTextToSize(text, contentW - indent);
    doc?.text(lines, margin + indent, y);
    return y + lines?.length * 5 + 2;
  };

  const addKV = (key, value, y) => {
    y = checkPageBreak(y, 7);
    doc?.setFontSize(7.5);
    doc?.setFont('helvetica', 'bold');
    doc?.setTextColor(148, 163, 184);
    doc?.text(`${key}:`, margin + 2, y);
    doc?.setFont('helvetica', 'normal');
    doc?.setTextColor(203, 213, 225);
    const lines = doc?.splitTextToSize(String(value), contentW - 40);
    doc?.text(lines, margin + 38, y);
    return y + Math.max(lines?.length * 4.5, 6);
  };

  const addSimpleTable = (headers, rows, y) => {
    y = checkPageBreak(y, 12);
    const colW = contentW / headers?.length;
    doc?.setFillColor(51, 65, 85);
    doc?.rect(margin, y, contentW, 7, 'F');
    doc?.setTextColor(255, 255, 255);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'bold');
    headers?.forEach((h, i) => doc?.text(String(h), margin + 2 + i * colW, y + 5));
    y += 7;
    doc?.setFont('helvetica', 'normal');
    rows?.forEach((row, ri) => {
      y = checkPageBreak(y, 7);
      doc?.setFillColor(ri % 2 === 0 ? 15 : 22, ri % 2 === 0 ? 23 : 30, ri % 2 === 0 ? 42 : 50);
      doc?.rect(margin, y, contentW, 6.5, 'F');
      doc?.setTextColor(203, 213, 225);
      row?.forEach((cell, ci) => {
        const txt = String(cell ?? '—')?.substring(0, Math.floor(contentW / headers?.length / 2.2));
        doc?.text(txt, margin + 2 + ci * colW, y + 4.5);
      });
      y += 6.5;
    });
    return y + 4;
  };

  // ── PAGE 1: COVER ──
  let y = addDocHeader(0);

  y = addHeading('Overview', y);
  y = addText('Chimera is a full-stack email fleet management platform built on React (frontend) and Supabase (backend). It provides real-time monitoring, campaign management, AI-driven governance, and automated workflows for managing large-scale email sending infrastructure.', y);
  y += 2;
  y = addKV('Live URL', 'https://leadsconsult.co.za', y);
  y = addKV('Backend API', 'https://api.leadsconsult.co.za', y);
  y = addKV('Database', 'Supabase (Project: nuxpocayhrtgurfvsbjq)', y);
  y = addKV('Published URL', 'https://chimera-dashboard-xpcij10.public.builtwithrocket.new', y);
  y += 4;

  y = addHeading('Tech Stack', y);
  y = addSimpleTable(
    ['Layer', 'Technology'],
    [
      ['Frontend', 'React + Vite v7'],
      ['Styling', 'Tailwind CSS'],
      ['Database', 'Supabase (PostgreSQL)'],
      ['Auth', 'Supabase Auth (JWT)'],
      ['Real-time', 'Supabase Realtime (WebSocket)'],
      ['Edge Functions', 'Supabase Edge Functions (Deno)'],
      ['Email', 'Resend via Supabase'],
      ['Analytics', 'Google Analytics 4 (G-E7JL5224KW)'],
      ['AI', 'OpenAI GPT-4'],
      ['Scheduling', 'Supabase pg_cron + browser cronService'],
      ['Hosting', 'Hostinger (frontend) + VPS 102.219.85.165 (legacy)'],
      ['SSL', "Let's Encrypt (auto-renewal May 2026)"],
    ],
    y
  );
  y += 4;

  // ── ARCHITECTURE ──
  y = addHeading('Architecture', y);
  y = addText('Browser (React App) → Supabase Auth (JWT) → Supabase Realtime (WebSocket) → Supabase Database (direct queries) → Supabase Edge Functions (API calls) → PostgreSQL (22 tables) + Resend (email) + OpenAI (AI) + pg_cron (scheduled jobs)', y);
  y += 4;

  y = addHeading('Frontend Structure', y);
  const fsRows = [
    ['src/App.jsx', 'Root app component'],
    ['src/Routes.jsx', '33 protected route definitions'],
    ['src/contexts/AuthContext.jsx', 'Global auth state (JWT)'],
    ['src/lib/supabase.js', 'Supabase client (30s timeout, in-memory cache)'],
    ['src/services/exportService.js', 'PDF/CSV export utilities'],
    ['src/services/cronService.js', 'Browser-based fallback scheduler'],
    ['src/services/thresholdAlertService.js', 'Real-time error rate monitor'],
    ['src/services/alertNotificationService.js', 'Email + browser alert dispatcher'],
    ['src/utils/offlineDetection.js', 'Network loss detection + cache fallback'],
    ['src/hooks/useGoogleAnalytics.js', 'GA4 page view tracking'],
    ['src/pages/', '33 screen modules'],
    ['src/components/ui/', 'Shared UI components (Sidebar, Header, Toast, etc.)'],
  ];
  y = addSimpleTable(['Path', 'Purpose'], fsRows, y);

  // ── PAGE: SCREENS ──
  doc?.addPage();
  y = 20;
  y = addHeading('Screens (33 Total)', y);

  y = addHeading('Core Operations', y, 2);
  const coreScreens = [
    ['War Room Dashboard', '/war-room-dashboard', 'Real-time fleet overview, server health, alert feed'],
    ['Campaign Manager', '/campaign-manager', 'Create, manage, queue email campaigns'],
    ['Server Management', '/server-management', 'Mail server fleet control'],
    ['Server Detail', '/server-detail/:id', 'Per-server deep dive with real-time logs'],
    ['Server Autopsy', '/server-autopsy', 'Post-mortem analysis for failed servers'],
    ['Domain Management', '/data-intelligence-hub', 'SPF/DKIM/DMARC tracking and warmup'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], coreScreens, y);
  y += 2;

  y = addHeading('Intelligence & Analytics', y, 2);
  const intelScreens = [
    ['Data Intelligence Hub', '/data-intelligence-hub', 'Contact management, list cleaning, verification'],
    ['Market Intelligence', '/market-intelligence-dashboard', 'Competitor monitoring, RSS feed analysis'],
    ['AI Insights', '/ai-insights-dashboard', 'OpenAI-powered recommendations'],
    ['Risk-Aware Campaign Creator', '/risk-aware-campaign-creator', 'Spam score analysis before sending'],
    ['Performance Monitoring', '/performance-monitoring-dashboard', 'Delivery rates, bounce rates, engagement'],
    ['Analytics Overview', '/enhanced-system-overview', 'Charts and trend data'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], intelScreens, y);
  y += 2;

  y = addHeading('Financial & Cost', y, 2);
  const finScreens = [
    ['Cost Management', '/cost-management-dashboard', 'Per-server cost tracking'],
    ['Financial Management', '/financial-management', 'Revenue and expense overview'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], finScreens, y);
  y += 2;

  y = addHeading('Automation & Rules', y, 2);
  const autoScreens = [
    ['Automation Hub', '/automation-hub', 'Workflow builder'],
    ['Workflow Rules', '/workflow-rules', 'Trigger-based automation rules'],
    ['A/B Testing', '/ab-testing-engine', 'Campaign variant testing'],
    ['STO Scheduler', '/sto-scheduler', 'Send-time optimization scheduler'],
    ['Zero-Click AI', '/zero-click-campaign', 'AI-driven zero-click campaigns'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], autoScreens, y);
  y += 2;

  y = addHeading('System Monitoring', y, 2);
  const sysScreens = [
    ['System Health', '/system-health', 'Edge function metrics, error rates, real-time logs'],
    ['Uptime Dashboard', '/uptime-dashboard', '24h availability graphs, function detail panels'],
    ['Incident Response', '/incident-response', 'P1-P4 incident management with runbooks'],
    ['Enhanced System Overview', '/enhanced-system-overview', 'Full system activity audit trail'],
    ['System Health Check', '/system-health-check', 'Live diagnostics and health scoring'],
    ['Anomaly Detection', '/anomaly-detection-dashboard', 'ML anomaly detection and remediation'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], sysScreens, y);
  y += 2;

  y = addHeading('Configuration', y, 2);
  const configScreens = [
    ['Notification Preferences', '/notification-preferences', 'Alert thresholds and channels'],
    ['Backup & Restore', '/backup-restore-management', 'Database backup management'],
    ['User Management RBAC', '/user-management-rbac', 'Role-based access control'],
    ['Server Provisioning Wizard', '/server-provisioning-wizard', 'Step-by-step server setup'],
    ['Contact Lists Management', '/contact-lists-management', 'Upload and manage contact lists'],
  ];
  y = addSimpleTable(['Screen', 'Route', 'Purpose'], configScreens, y);

  // ── PAGE: DATABASE ──
  doc?.addPage();
  y = 20;
  y = addHeading('Database (22 Tables)', y);
  y = addText('All tables have Row Level Security (RLS) enabled. Database hosted on Supabase PostgreSQL.', y);
  y += 2;
  const dbRows = [
    ['user_profiles', 'Auth user profiles'],
    ['servers', 'Mail server fleet'],
    ['domains', 'Domain health and warmup'],
    ['contact_lists', 'Email list groups'],
    ['contacts', 'Individual contacts with engagement tiers'],
    ['campaigns', 'Email campaign definitions'],
    ['campaign_queue', 'Outbound email queue'],
    ['verification_jobs', 'Email verification job tracking'],
    ['system_logs', 'All system events (5,232+ rows)'],
    ['complaint_reports', 'Bounces, spam complaints, FBL'],
    ['transactions', 'Financial transactions'],
    ['costs', 'Server cost records'],
    ['anomalies', 'Detected system anomalies'],
    ['backup_history', 'Backup job records'],
    ['competitor_campaigns', 'Market intelligence data'],
    ['workflow_rules', 'Automation trigger rules'],
    ['edge_function_logs', 'Function execution logs'],
    ['edge_function_rate_limits', 'Rate limiting per user/function'],
    ['function_alert_state', 'Alert cooldown tracking'],
    ['user_threshold_rules', 'Custom alert thresholds'],
    ['uptime_snapshots', 'Hourly availability metrics'],
    ['incidents', 'Incident response records'],
  ];
  y = addSimpleTable(['Table', 'Purpose'], dbRows, y);
  y += 4;

  y = addHeading('Database Migrations', y);
  const migRows = [
    ['20260225212650_chimera_schema.sql', 'Core schema — all primary tables'],
    ['20260227160000_backup_rbac_schema.sql', 'Backup history + RBAC tables'],
    ['20260228140000_competitor_campaigns.sql', 'Market intelligence tables'],
    ['20260228150000_workflow_rules.sql', 'Automation workflow rules'],
    ['20260314000000_pg_cron_setup.sql', 'pg_cron job scheduling'],
    ['20260314200000_edge_function_logs_rls.sql', 'Edge function logs + RLS'],
    ['20260314210000_uptime_alerts_schema.sql', 'Uptime snapshots + alert state'],
    ['20260314220000_incidents_schema.sql', 'Incident response schema'],
  ];
  y = addSimpleTable(['Migration File', 'Purpose'], migRows, y);

  // ── PAGE: EDGE FUNCTIONS ──
  doc?.addPage();
  y = 20;
  y = addHeading('Edge Functions (13 Deployed)', y);
  y = addText('All functions deployed to Supabase Edge Functions (Deno runtime). Deploy command: supabase functions deploy [name] --project-ref nuxpocayhrtgurfvsbjq', y);
  y += 2;
  const efRows = [
    ['health-check', 'System health metrics', 'On-demand'],
    ['campaign-actions', 'Queue/pause/resume campaigns', 'On-demand'],
    ['server-actions', 'Quarantine/restore servers', 'On-demand'],
    ['analytics-overview', 'Aggregated analytics data', 'On-demand'],
    ['anomaly-remediate', 'Auto-fix detected anomalies', 'On-demand'],
    ['verification-worker', 'Email list verification', 'On-demand'],
    ['backup-manager', 'Backup/restore operations', 'On-demand'],
    ['intelligence-crawler', 'RSS + competitor monitoring', 'On-demand'],
    ['campaign-dispatcher', 'Send queued campaigns', 'Every 1 min'],
    ['bounce-processor', 'Process bounces and complaints', 'Every 10 min'],
    ['ai-governor', 'Domain health governance', 'Daily 2AM'],
    ['send-alert-email', 'Resend email alerts', 'On-demand'],
    ['monitor-alerts', 'Error rate threshold monitoring', 'Every 5 min'],
  ];
  y = addSimpleTable(['Function', 'Purpose', 'Schedule'], efRows, y);
  y += 4;

  y = addHeading('pg_cron Jobs (7 Scheduled)', y);
  const cronRows = [
    ['chimera-health-monitor', 'Every 5 min', 'Server health checks'],
    ['chimera-campaign-dispatcher', 'Every 1 min', 'Email send queue'],
    ['chimera-bounce-processor', 'Every 10 min', 'Bounce/complaint processing'],
    ['chimera-ai-governor', 'Daily 2AM', 'Domain retirement + warmup'],
    ['chimera-engagement-segmenter', 'Daily midnight', 'Contact tier updates'],
    ['chimera-monitor-alerts', 'Every 5 min', 'Function error rate alerts'],
    ['chimera-uptime-snapshots', 'Every hour', 'Availability data collection'],
  ];
  y = addSimpleTable(['Job Name', 'Schedule', 'Purpose'], cronRows, y);
  y += 4;

  y = addHeading('Key Services', y);
  const serviceRows = [
    ['cronService.js', 'Browser-based fallback scheduler using setInterval. Runs all 5 workflows client-side when pg_cron unavailable.'],
    ['thresholdAlertService.js', 'Subscribes to edge_function_logs. WARNING at >5% error rate / >2s exec. CRITICAL at >10% / >5s.'],
    ['alertNotificationService.js', 'Subscribes to system_logs + anomalies. Triggers browser + email alerts. 30-min cooldown per function.'],
    ['offlineDetection.js', 'Detects network loss, serves cached localStorage data, shows offline banner. Resumes on reconnect.'],
    ['exportService.js', 'PDF/CSV export for War Room, Anomaly, Server Autopsy reports and Developer Documentation.'],
  ];
  y = addSimpleTable(['Service', 'Description'], serviceRows, y);

  // ── PAGE: AUTH, REALTIME, ENV ──
  doc?.addPage();
  y = 20;
  y = addHeading('Authentication', y);
  y = addKV('Provider', 'Supabase Auth (email/password)', y);
  y = addKV('Protected Routes', 'All 33 routes via ProtectedRoute component', y);
  y = addKV('Public Routes', '/login, /diagnostic', y);
  y = addKV('Session Persistence', 'Supabase handles JWT refresh automatically', y);
  y = addKV('Default Admin', 'admin@chimera.io / chimera2026', y);
  y += 4;

  y = addHeading('Real-time Subscriptions', y);
  y = addText('Active Supabase Realtime channels on the following tables:', y);
  const rtRows = [
    ['servers', 'War Room, System Overview'],
    ['campaigns', 'Campaign Manager, War Room'],
    ['system_logs', 'War Room alert feed, Server Detail'],
    ['anomalies', 'Anomaly Detection, War Room'],
    ['workflow_rules', 'Workflow Rules screen'],
    ['contacts + contact_lists', 'Data Intelligence Hub'],
    ['edge_function_logs', 'System Health, Threshold Alert Service'],
    ['incidents', 'Incident Response screen'],
  ];
  y = addSimpleTable(['Table', 'Used By'], rtRows, y);
  y += 4;

  y = addHeading('Environment Variables', y);
  const envRows = [
    ['VITE_SUPABASE_URL', 'https://nuxpocayhrtgurfvsbjq.supabase.co', 'Required'],
    ['VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 'Required'],
    ['VITE_OPENAI_API_KEY', 'sk-proj-sZRMW3sm...', 'Required'],
    ['VITE_GA_MEASUREMENT_ID', 'G-E7JL5224KW', 'Required'],
    ['VITE_PERPLEXITY_API_KEY', 'Not configured', 'Optional — market intelligence'],
    ['VITE_STRIPE_PUBLISHABLE_KEY', 'Not configured', 'Optional — payment features'],
    ['VITE_GEMINI_API_KEY', 'Not configured', 'Optional — Gemini AI features'],
    ['VITE_ANTHROPIC_API_KEY', 'Not configured', 'Optional — Claude AI features'],
  ];
  y = addSimpleTable(['Variable', 'Value / Status', 'Notes'], envRows, y);

  // ── PAGE: DEPLOYMENT + ALERTS ──
  doc?.addPage();
  y = 20;
  y = addHeading('Deployment', y);

  y = addHeading('Frontend (Hostinger)', y, 2);
  y = addKV('Host', 'Hostinger shared hosting', y);
  y = addKV('Path', '/home/leadscon/domains/leadsconsult.co.za/public_html/', y);
  y = addKV('Build Command', 'npm run build --legacy-peer-deps', y);
  y = addKV('Output', 'build/ folder', y);
  y = addKV('Routing', '.htaccess SPA fallback (all routes → index.html)', y);
  y += 4;

  y = addHeading('Backend (Legacy VPS — no longer required)', y, 2);
  y = addKV('IP', '102.219.85.165', y);
  y = addKV('OS', 'Ubuntu 24.04 LTS', y);
  y = addKV('Runtime', 'Node.js v20.20.0 + PM2', y);
  y = addKV('Nginx', 'Reverse proxy with SSL', y);
  y = addKV('Path', '/root/chimera-backend/backend/', y);
  y = addKV('Start', 'pm2 start server.js --name chimera-backend', y);
  y += 4;

  y = addHeading('Edge Functions Deployment', y, 2);
  y = addKV('Deploy', 'supabase functions deploy [function-name] --project-ref nuxpocayhrtgurfvsbjq', y);
  y = addKV('Secrets', 'supabase secrets set RESEND_API_KEY=re_HxdTktTu_...', y);
  y += 4;

  y = addHeading('Alert & Monitoring System', y);
  y = addKV('Email Alerts To', 'info@leadsconsult.co.za', y);
  y = addKV('From', 'alerts@leadsconsult.co.za (via Resend)', y);
  y += 2;
  y = addText('Triggers:', y);
  const alertTriggers = [
    '• Edge function error rate exceeds 5% (30-min cooldown)',
    '• P1 incidents auto-escalate after 15 minutes',
    '• P2 incidents auto-escalate after 30 minutes',
    '• Server quarantine events',
    '• Bounce rate spikes',
  ];
  alertTriggers?.forEach(t => { y = addText(t, y, 4); });
  y += 4;

  y = addHeading('Known Limitations', y);
  const limitRows = [
    ['pg_cron', 'Requires Supabase Pro plan — Free tier uses browser cronService.js fallback'],
    ['Perplexity', 'Not connected — market intelligence uses mock/RSS data only'],
    ['Stripe', 'Not connected — financial management shows static data'],
    ['VPS', 'Still running but not required — can be shut down to save costs'],
  ];
  y = addSimpleTable(['Component', 'Limitation'], limitRows, y);
  y += 4;

  y = addHeading('Go-Live Checklist', y);
  const checklistRows = [
    ['✅', 'Frontend deployed to Hostinger'],
    ['✅', 'Supabase database with 22 tables'],
    ['✅', 'All 13 Edge Functions deployed'],
    ['✅', 'All 8 SQL migrations applied'],
    ['✅', 'RLS enabled on all tables'],
    ['✅', 'Resend email alerts configured'],
    ['✅', 'Google Analytics tracking active'],
    ['✅', 'OpenAI connected for AI features'],
    ['✅', 'SSL certificate on API domain'],
    ['✅', 'Real-time subscriptions on all key screens'],
    ['✅', 'Offline detection and cached data fallback'],
    ['✅', 'Error toasts on all Supabase calls'],
    ['✅', 'Rate limiting (100 req/min per user)'],
    ['✅', 'JWT validation on edge functions'],
  ];
  y = addSimpleTable(['Status', 'Item'], checklistRows, y);

  // Footer on last page
  y = checkPageBreak(y, 20);
  y += 6;
  doc?.setFillColor(15, 23, 42);
  doc?.rect(0, pageH - 14, pageW, 14, 'F');
  doc?.setTextColor(148, 163, 184);
  doc?.setFontSize(7);
  doc?.text('Chimera Dashboard v5.0 — System is production-ready 🚀', pageW / 2, pageH - 6, { align: 'center' });

  doc?.save(`chimera-developer-docs-${new Date()?.toISOString()?.split('T')?.[0]}.pdf`);
};
