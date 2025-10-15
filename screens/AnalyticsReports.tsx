import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function AnalyticsReports() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricIcon}>📹</Text>
          <Text style={styles.metricValue}>1,245</Text>
          <Text style={styles.metricLabel}>Total Evidence</Text>
          <Text style={styles.metricChange}>↑ 12% this month</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricIcon}>⏱️</Text>
          <Text style={styles.metricValue}>3.2h</Text>
          <Text style={styles.metricLabel}>Avg Response Time</Text>
          <Text style={styles.metricChange}>↓ 8% improvement</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricIcon}>✅</Text>
          <Text style={styles.metricValue}>89%</Text>
          <Text style={styles.metricLabel}>Cases Resolved</Text>
          <Text style={styles.metricChange}>↑ 5% this week</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricIcon}>👥</Text>
          <Text style={styles.metricValue}>42</Text>
          <Text style={styles.metricLabel}>Active Users</Text>
          <Text style={styles.metricChange}>+3 new this week</Text>
        </View>
      </View>

      {/* Charts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Evidence Collection Trend</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartPlaceholder}>
            <View style={styles.barChart}>
              <View style={[styles.bar, { height: '60%' }]}>
                <Text style={styles.barLabel}>Mon</Text>
              </View>
              <View style={[styles.bar, { height: '75%' }]}>
                <Text style={styles.barLabel}>Tue</Text>
              </View>
              <View style={[styles.bar, { height: '50%' }]}>
                <Text style={styles.barLabel}>Wed</Text>
              </View>
              <View style={[styles.bar, { height: '85%' }]}>
                <Text style={styles.barLabel}>Thu</Text>
              </View>
              <View style={[styles.bar, { height: '70%' }]}>
                <Text style={styles.barLabel}>Fri</Text>
              </View>
              <View style={[styles.bar, { height: '45%' }]}>
                <Text style={styles.barLabel}>Sat</Text>
              </View>
              <View style={[styles.bar, { height: '30%' }]}>
                <Text style={styles.barLabel}>Sun</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🥧 Evidence Types Distribution</Text>
        <View style={styles.chartContainer}>
          <View style={styles.pieChartPlaceholder}>
            <Text style={styles.pieChartText}>📊</Text>
            <Text style={styles.pieChartLabel}>Pie Chart</Text>
          </View>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Video (45%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Images (30%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Audio (15%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Documents (10%)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Reports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📄 Quick Reports</Text>
        <View style={styles.reportsGrid}>
          <TouchableOpacity style={styles.reportCard}>
            <Text style={styles.reportIcon}>📊</Text>
            <Text style={styles.reportTitle}>Monthly Summary</Text>
            <Text style={styles.reportSubtitle}>All cases & evidence</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportCard}>
            <Text style={styles.reportIcon}>👥</Text>
            <Text style={styles.reportTitle}>User Activity</Text>
            <Text style={styles.reportSubtitle}>Login & usage stats</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportCard}>
            <Text style={styles.reportIcon}>🔒</Text>
            <Text style={styles.reportTitle}>Security Report</Text>
            <Text style={styles.reportSubtitle}>Access logs & alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportCard}>
            <Text style={styles.reportIcon}>📱</Text>
            <Text style={styles.reportTitle}>Device Health</Text>
            <Text style={styles.reportSubtitle}>Status & performance</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  metricChange: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartPlaceholder: {
    height: 200,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingVertical: 10,
  },
  bar: {
    width: 30,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
  },
  barLabel: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  pieChartPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 16,
  },
  pieChartText: {
    fontSize: 60,
    marginBottom: 8,
  },
  pieChartLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  legendContainer: {
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
    textAlign: 'center',
  },
  reportSubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});
