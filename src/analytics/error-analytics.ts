/**
 * Error Analytics - US-078
 * Track and analyze error metrics
 *
 * @ac US-078-AC-1: Track error metrics
 * @ac US-078-AC-2: Error frequency analysis
 * @ac US-078-AC-3: Error trending
 * @ac US-078-AC-4: Identify top errors
 * @ac US-078-AC-5: Export metrics
 * @ac US-078-AC-6: Dashboard/visualization
 * @issue #78
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ErrorAnalytics');

export interface ErrorMetric {
  code: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  category: string;
}

export interface ErrorTrend {
  code: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

export interface ErrorAnalyticsReport {
  totalErrors: number;
  uniqueErrors: number;
  topErrors: ErrorMetric[];
  trends: ErrorTrend[];
  categoryBreakdown: Record<string, number>;
  timeRange: { start: Date; end: Date };
}

/**
 * @ac US-078-AC-1: Track error metrics
 */
export class ErrorAnalytics {
  private readonly metrics: Map<string, ErrorMetric> = new Map();
  private readonly history: Array<{ code: string; timestamp: Date }> = [];

  /**
   * @ac US-078-AC-1: Track error metrics
   * Record error occurrence
   */
  public recordError(code: string, category: string): void {
    const existing = this.metrics.get(code);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
    } else {
      this.metrics.set(code, {
        code,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        category,
      });
    }

    this.history.push({ code, timestamp: new Date() });

    logger.debug('Error recorded', { code, category });
  }

  /**
   * @ac US-078-AC-2: Error frequency analysis
   * Get error frequency
   */
  public getFrequency(code: string, timeWindow: number = 3600000): number {
    const now = Date.now();
    const windowStart = now - timeWindow;

    return this.history.filter((entry) => entry.code === code && entry.timestamp.getTime() >= windowStart).length;
  }

  /**
   * @ac US-078-AC-3: Error trending
   * Analyze error trends
   */
  public analyzeTrends(): ErrorTrend[] {
    const trends: ErrorTrend[] = [];

    for (const [code] of this.metrics.entries()) {
      const recentCount = this.getFrequency(code, 3600000); // Last hour
      const olderCount = this.getFrequency(code, 7200000) - recentCount; // Previous hour

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let changePercentage = 0;

      if (olderCount > 0) {
        changePercentage = ((recentCount - olderCount) / olderCount) * 100;

        if (changePercentage > 20) {
          trend = 'increasing';
        } else if (changePercentage < -20) {
          trend = 'decreasing';
        }
      } else if (recentCount > 0) {
        trend = 'increasing';
        changePercentage = 100;
      }

      trends.push({ code, trend, changePercentage });
    }

    return trends;
  }

  /**
   * @ac US-078-AC-4: Identify top errors
   * Get top N most frequent errors
   */
  public getTopErrors(limit = 10): ErrorMetric[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * @ac US-078-AC-5: Export metrics
   * Generate analytics report
   */
  public generateReport(): ErrorAnalyticsReport {
    const topErrors = this.getTopErrors(10);
    const trends = this.analyzeTrends();

    const categoryBreakdown: Record<string, number> = {};
    for (const metric of this.metrics.values()) {
      categoryBreakdown[metric.category] = (categoryBreakdown[metric.category] || 0) + metric.count;
    }

    const timestamps = this.history.map((h) => h.timestamp.getTime());
    const start = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
    const end = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();

    return {
      totalErrors: this.history.length,
      uniqueErrors: this.metrics.size,
      topErrors,
      trends,
      categoryBreakdown,
      timeRange: { start, end },
    };
  }

  /**
   * @ac US-078-AC-6: Dashboard/visualization
   * Format analytics dashboard
   */
  public formatDashboard(report: ErrorAnalyticsReport): string {
    const lines: string[] = [];

    lines.push('📊 Error Analytics Dashboard');
    lines.push('═══════════════════════════════════════');
    lines.push(`Total Errors: ${report.totalErrors}`);
    lines.push(`Unique Error Types: ${report.uniqueErrors}`);
    lines.push(`Time Range: ${report.timeRange.start.toISOString()} to ${report.timeRange.end.toISOString()}`);
    lines.push('');

    lines.push('🔥 Top Errors:');
    for (const [index, error] of report.topErrors.slice(0, 5).entries()) {
      lines.push(`   ${index + 1}. ${error.code}: ${error.count} occurrences`);
    }
    lines.push('');

    lines.push('📈 Trending:');
    const increasing = report.trends.filter((t) => t.trend === 'increasing');
    if (increasing.length > 0) {
      for (const trend of increasing.slice(0, 3)) {
        lines.push(`   ⬆️  ${trend.code}: +${trend.changePercentage.toFixed(0)}%`);
      }
    } else {
      lines.push('   ✅ No increasing trends');
    }
    lines.push('');

    lines.push('🗂️  By Category:');
    for (const [category, count] of Object.entries(report.categoryBreakdown)) {
      lines.push(`   ${category}: ${count}`);
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  public exportJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Reset analytics
   */
  public reset(): void {
    this.metrics.clear();
    this.history.length = 0;
    logger.info('Error analytics reset');
  }
}
