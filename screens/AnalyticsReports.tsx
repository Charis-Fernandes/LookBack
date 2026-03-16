import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import FirebaseService, {
  AccessLogItem,
  CaseItem,
  ProcessedDocument,
  UserItem,
  EvidenceItem,
} from '../services/FirebaseService';

type TrendBucket = {
  label: string;
  value: number;
};

type DistributionItem = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const REPORT_COLORS = {
  FIR: '#3b82f6',
  ID_CARD: '#10b981',
  POLICE_REPORT: '#f59e0b',
  CHARGE_SHEET: '#ef4444',
  UNKNOWN: '#8b5cf6',
};

const formatPercent = (v: number): string => `${Math.round(v)}%`;

const buildTrend = (docs: ProcessedDocument[], days: number): TrendBucket[] => {
  const buckets: TrendBucket[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Fallback to 7 days if "ALL" is selected but we still want a graph (or perhaps 30 days)
  const actualDays = days > 365 ? 30 : days;

  for (let i = actualDays - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const value = docs.filter((d) => {
      const t = d.processedAt || d.timestamp || 0;
      return t >= start.getTime() && t < end.getTime();
    }).length;

    let label = '';
    if (actualDays <= 14) {
      label = start.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    buckets.push({ label, value });
  }

  // If too many buckets (e.g. 90 days), decimate them so UI isn't overcrowded
  if (buckets.length > 30) {
     const step = Math.floor(buckets.length / 10);
     return buckets.filter((_, idx) => idx % step === 0);
  }

  return buckets;
};

const buildDistribution = (docs: ProcessedDocument[]): DistributionItem[] => {
  const counts = docs.reduce<Record<string, number>>((acc, d) => {
    const key = d.docType || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const keys = ['FIR', 'ID_CARD', 'POLICE_REPORT', 'CHARGE_SHEET', 'UNKNOWN'];
  return keys
    .filter((k) => (counts[k] || 0) > 0)
    .map((k) => ({
      key: k,
      label: k.replace('_', ' '),
      value: counts[k],
      color: REPORT_COLORS[k as keyof typeof REPORT_COLORS] || '#94a3b8',
    }));
};

export default function AnalyticsReports() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [allDocs, setAllDocs] = useState<ProcessedDocument[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  // Filter States
  const [dateRange, setDateRange] = useState<number | 'CUSTOM'>(7); 
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  const [selectedType, setSelectedType] = useState<string>('ALL'); // ALL, FIR, ID_CARD, etc.

  const loadAnalytics = useCallback(async () => {
    try {
      const [usersData, casesData, logsData, docsData, evidenceData] = await Promise.all([
        FirebaseService.listUsers(),
        FirebaseService.listCases(),
        FirebaseService.getAccessLogs(500),
        FirebaseService.listProcessedDocuments(1000),
        FirebaseService.listEvidence(1000),
      ]);

      setUsers(usersData);
      setCases(casesData);
      setLogs(logsData);
      setAllDocs(docsData);
      setEvidence(evidenceData);
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  // Derived filter logic
  const filteredDocs = useMemo(() => {
    const now = new Date().getTime();
    let cutoff = now - (Number(dateRange) * 24 * 60 * 60 * 1000);
    
    let cStart = 0;
    let cEnd = now;

    if (dateRange === 'CUSTOM') {
      const parsedStart = Date.parse(customStart);
      const parsedEnd = Date.parse(customEnd);
      cStart = isNaN(parsedStart) ? 0 : parsedStart;
      cEnd = isNaN(parsedEnd) ? now : parsedEnd + 86400000; // include end of day
    }

    return allDocs.filter(d => {
      // Type filter
      if (selectedType !== 'ALL' && d.docType !== selectedType) return false;
      // Date filter
      const t = d.processedAt || d.timestamp || 0;
      
      if (dateRange === 'CUSTOM') {
        if (t < cStart || t > cEnd) return false;
      } else if (dateRange !== 999 && t < cutoff) {
        return false;
      }
      
      return true;
    });
  }, [allDocs, dateRange, selectedType, customStart, customEnd]);

  const trend = useMemo(() => buildTrend(filteredDocs, dateRange === 999 || dateRange === 'CUSTOM' ? 30 : Number(dateRange)), [filteredDocs, dateRange]);
  const distribution = useMemo(() => buildDistribution(filteredDocs), [filteredDocs]);

  // Keyword extraction for "Top Entities" Graph
  const keywordStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDocs.forEach(d => {
      if (d.searchKeywords) {
        d.searchKeywords.forEach(k => {
          if (k.length > 4) counts[k] = (counts[k] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [filteredDocs]);

  // Audit Events distribution 
  const auditDist = useMemo(() => {
    let views = 0, logins = 0, security = 0;
    logs.forEach(l => {
       const action = (l.action || '').toLowerCase();
       if (action.includes('delete') || action.includes('fail') || action.includes('unauth')) security++;
       else if (action.includes('login') || action.includes('auth')) logins++;
       else views++;
    });
    const total = views + logins + security || 1;
    return [
      { label: 'VIEWS/QUERIES', value: views, pct: (views / total) * 100, color: '#3b82f6' },
      { label: 'AUTH EVENTS', value: logins, pct: (logins / total) * 100, color: '#f59e0b' },
      { label: 'RISK / FLAGS', value: security, pct: (security / total) * 100, color: '#ef4444' },
    ];
  }, [logs]);

  const activeUsers = users.filter((u) => u.status === 'active').length;
  const closedCases = cases.filter((c) => c.status === 'closed').length;
  const resolvedRate = cases.length ? (closedCases / cases.length) * 100 : 0;

  const securityEvents = logs.filter((l) => {
    const action = (l.action || '').toLowerCase();
    return action.includes('delete') || action.includes('failed') || action.includes('unauthorized');
  }).length;

  const maxTrend = trend.length ? Math.max(1, ...trend.map((b) => b.value)) : 1;
  const totalDocs = filteredDocs.length;
  const maxKeyword = keywordStats.length ? Math.max(...keywordStats.map(k => k.value)) : 1;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0f172a" />
        <Text style={styles.loadingText}>INITIALIZING SYS-METRICS...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />}
    >
      <View style={styles.headerTitleContainer}>
        <Text style={styles.mainTitle}>ANALYTICS & REPORTS</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.filterTitle}>TIME RANGE</Text>
        <View style={styles.filterRow}>
          {[ {label: '7 DAYS', v: 7}, {label: '30 DAYS', v: 30}, {label: '90 DAYS', v: 90}, {label: 'ALL TIME', v: 999}, {label: 'CUSTOM', v: 'CUSTOM'} ].map(f => (
            <TouchableOpacity 
              key={f.label} 
              onPress={() => setDateRange(f.v as any)}
              style={[styles.filterChip, dateRange === f.v && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, dateRange === f.v && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {dateRange === 'CUSTOM' && (
          <View style={styles.customDateRow}>
             <TextInput 
               style={styles.dateInput}
               placeholder="Start (YYYY-MM-DD)"
               placeholderTextColor="#94a3b8"
               value={customStart}
               onChangeText={setCustomStart}
             />
             <Text style={styles.dateDash}>—</Text>
             <TextInput 
               style={styles.dateInput}
               placeholder="End (YYYY-MM-DD)"
               placeholderTextColor="#94a3b8"
               value={customEnd}
               onChangeText={setCustomEnd}
             />
          </View>
        )}

        <Text style={styles.filterTitle}>DOC FILTER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.filterRow}>
            {['ALL', 'FIR', 'ID_CARD', 'POLICE_REPORT', 'CHARGE_SHEET'].map(t => (
              <TouchableOpacity 
                key={t} 
                onPress={() => setSelectedType(t)}
                style={[styles.filterChip, selectedType === t && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, selectedType === t && styles.filterChipTextActive]}>{t.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Charts Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INGESTION VOLUME ({dateRange === 999 ? 'ALL TIME' : dateRange === 'CUSTOM' ? 'CUSTOM RANGE' : `LAST ${dateRange}D`})</Text>
        </View>
        <View style={styles.chartContainer}>
          <View style={styles.chartPlaceholder}>
            <View style={styles.barChart}>
              {trend.map((bucket, i) => {
                const pct = Math.max(8, (bucket.value / maxTrend) * 100);
                return (
                  <View key={`${bucket.label}-${i}`} style={styles.barWrap}>
                    <Text style={styles.barTopValue}>{bucket.value}</Text>
                    <View style={[styles.bar, { height: `${pct}%`, backgroundColor: bucket.value > 0 ? '#1e293b' : '#cbd5e1' }]} />
                    <Text numberOfLines={1} style={styles.barLabelBottom}>{bucket.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>CLASSIFICATION DIST (GLOBAL)</Text>
        </View>
        <View style={styles.chartContainer}>
          {distribution.length === 0 ? (
            <View style={styles.pieChartPlaceholder}>
              <Text style={styles.pieChartLabel}>NO INDEXED DATA FOUND</Text>
            </View>
          ) : null}
          <View style={styles.legendContainer}>
            {distribution.map((item) => {
              const allCount = filteredDocs.length;
              const pct = allCount ? Math.round((item.value / allCount) * 100) : 0;
              return (
                <View key={item.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.label}  —  {item.value} ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Additional Visualizations */}
      <View style={{flexDirection: 'row', gap: 12, marginBottom: 26}}>
         {/* Audit Events */}
         <View style={[styles.section, {flex: 1, marginBottom: 0}]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AUDIT EVENTS</Text>
            </View>
            <View style={[styles.chartContainer, {padding: 12}]}>
               {auditDist.map(c => (
                 <View key={c.label} style={{marginBottom: 10}}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
                     <Text style={{fontSize: 9, fontWeight: '700', color: '#475569'}}>{c.label}</Text>
                     <Text style={{fontSize: 9, fontWeight: '700', color: '#0f172a'}}>{c.value}</Text>
                   </View>
                   <View style={{height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden'}}>
                      <View style={{height: '100%', width: `${Math.max(2, c.pct)}%`, backgroundColor: c.color}} />
                   </View>
                 </View>
               ))}
            </View>
         </View>

         {/* Top keywords */}
         <View style={[styles.section, {flex: 1, marginBottom: 0}]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TOP ENTITIES</Text>
            </View>
            <View style={[styles.chartContainer, {padding: 12}]}>
               {keywordStats.length === 0 ? <Text style={styles.pieChartLabel}>NO ENTITIES</Text> : null}
               {keywordStats.map(k => (
                 <View key={k.label} style={{marginBottom: 8}}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2}}>
                     <Text style={{fontSize: 9, fontWeight: '700', color: '#475569'}}>{k.label}</Text>
                     <Text style={{fontSize: 9, fontWeight: '700', color: '#0f172a'}}>{k.value}</Text>
                   </View>
                   <View style={{height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden'}}>
                      <View style={{height: '100%', width: `${Math.max(5, (k.value / maxKeyword) * 100)}%`, backgroundColor: '#3b82f6'}} />
                   </View>
                 </View>
               ))}
            </View>
         </View>
      </View>

      {/* Quick Reports */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>SYSTEM MODULES</Text>
        </View>
        <View style={styles.reportsGrid}>
          <TouchableOpacity style={styles.reportCard} activeOpacity={0.9}>
            <Text style={styles.reportTitle}>OPERATIONS LOG</Text>
            <Text style={styles.reportSubtitle}>Ev: {evidence.length} | Cs: {cases.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportCard} activeOpacity={0.9}>
            <Text style={styles.reportTitle}>AUDIT TRAIL</Text>
            <Text style={styles.reportSubtitle}>{logs.length} tracked events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.reportCard, securityEvents > 0 && styles.reportCardAlert]} activeOpacity={0.9}>
            <Text style={[styles.reportTitle, securityEvents > 0 && styles.reportTitleAlert]}>RISK ALERTS</Text>
            <Text style={[styles.reportSubtitle, securityEvents > 0 && styles.reportSubtitleAlert]}>{securityEvents} flagged</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportCard} activeOpacity={0.9}>
            <Text style={styles.reportTitle}>AI WORKER</Text>
            <Text style={styles.reportSubtitle}>{totalDocs} records synched</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 18,
  },
  headerTitleContainer: {
    marginBottom: 20,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 10,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  filtersSection: {
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  hScroll: {
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#f8fafc',
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  dateDash: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 26,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricCardHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  metricChange: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
  section: {
    marginBottom: 26,
  },
  sectionHeader: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    paddingLeft: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chartPlaceholder: {
    height: 180,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingVertical: 6,
    gap: 4,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barTopValue: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '700',
  },
  bar: {
    width: '100%',
    maxWidth: 20,
    borderRadius: 2,
    minHeight: 4,
  },
  barLabelBottom: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 6,
  },
  pieChartPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  pieChartLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  legendContainer: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 12,
  },
  legendText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reportCardAlert: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  reportTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  reportTitleAlert: {
    color: '#b91c1c',
  },
  reportSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  reportSubtitleAlert: {
    color: '#ef4444',
  },
});
