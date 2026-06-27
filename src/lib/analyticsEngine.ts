import { SCHOOLS, DISTRICTS, YEARLY_PERFORMANCE, SUBJECTS, CANDIDATE_RECORDS } from "../data/unebData";
import { School, SchoolYearlyPerformance, ExamLevel, Region } from "../types";

export class AnalyticsEngine {
  // 1. Get School Rankings for a given year and level
  static getRankings(year: number, level: ExamLevel) {
    const performances = YEARLY_PERFORMANCE.filter(p => p.year === year && p.level === level);
    
    const ranked = performances.map(p => {
      const school = SCHOOLS.find(s => s.id === p.schoolId)!;
      
      // Rank by quality pass:
      // For UCE: Div 1 rate
      // For UACE: 3 Principal passes rate
      const total = p.totalCandidates;
      const topDivRate = total > 0 ? (p.divisions.div1Or3Prin / total) * 100 : 0;
      
      return {
        schoolId: p.schoolId,
        schoolName: school.name,
        districtName: school.districtName,
        region: school.region,
        ownership: school.ownership,
        totalCandidates: total,
        passRate: p.passRate,
        topDivRate: parseFloat(topDivRate.toFixed(2)),
        meanScore: p.meanScore
      };
    });

    // Sort descending by top division rate (first priority) then by passRate
    return ranked.sort((a, b) => {
      if (b.topDivRate !== a.topDivRate) return b.topDivRate - a.topDivRate;
      return b.passRate - a.passRate;
    }).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  // 2. School consistency scores over the years (2015-2025)
  // Expresses how stable a school's results are.
  // Algorithm: 100 - (Standard Deviation of Mean Scores * 15). Capped between 0 and 100.
  static getSchoolConsistency(schoolId: string, level: ExamLevel) {
    const perfs = YEARLY_PERFORMANCE.filter(p => p.schoolId === schoolId && p.level === level);
    if (perfs.length <= 1) return 100;

    const meanScores = perfs.map(p => p.meanScore);
    const avgMean = meanScores.reduce((a, b) => a + b, 0) / meanScores.length;
    
    const variance = meanScores.reduce((sum, score) => sum + Math.pow(score - avgMean, 2), 0) / meanScores.length;
    const stdDev = Math.sqrt(variance);

    // Score: highly stable schools have low stdDev (e.g., 0.1 to 0.3), giving them consistency scores > 90.
    const score = Math.max(0, Math.min(100, 100 - stdDev * 18));
    return {
      averageScore: parseFloat(avgMean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(3)),
      consistencyScore: parseFloat(score.toFixed(1))
    };
  }

  // 3. School Performance comparison
  static compareSchools(schoolIds: string[], level: ExamLevel) {
    const results: any[] = [];
    
    schoolIds.forEach(id => {
      const school = SCHOOLS.find(s => s.id === id);
      if (!school) return;

      const perfs = YEARLY_PERFORMANCE.filter(p => p.schoolId === id && p.level === level)
        .sort((a, b) => a.year - b.year);

      const consistency = this.getSchoolConsistency(id, level);

      results.push({
        school,
        consistency,
        yearlyData: perfs.map(p => ({
          year: p.year,
          totalCandidates: p.totalCandidates,
          passRate: p.passRate,
          meanScore: p.meanScore,
          divisions: p.divisions,
          subjectAverages: p.subjectAverages
        }))
      });
    });

    return results;
  }

  // 4. District summaries
  static getDistrictPerformance(year: number, level: ExamLevel) {
    const districts = DISTRICTS.map(d => {
      const schoolsInDistrict = SCHOOLS.filter(s => s.districtId === d.id);
      const schoolIds = schoolsInDistrict.map(s => s.id);
      
      const perfs = YEARLY_PERFORMANCE.filter(p => p.year === year && p.level === level && schoolIds.includes(p.schoolId));
      
      if (perfs.length === 0) {
        return {
          districtId: d.id,
          name: d.name,
          region: d.region,
          povertyRate: d.povertyRate,
          schoolCount: d.schoolCount,
          totalCandidates: 0,
          averagePassRate: 0,
          meanScore: 0
        };
      }

      const totalCandidates = perfs.reduce((sum, p) => sum + p.totalCandidates, 0);
      const weightedPassSum = perfs.reduce((sum, p) => sum + (p.passRate * p.totalCandidates), 0);
      const averagePassRate = totalCandidates > 0 ? weightedPassSum / totalCandidates : 0;
      const averageMeanScore = perfs.reduce((sum, p) => sum + p.meanScore, 0) / perfs.length;

      return {
        districtId: d.id,
        name: d.name,
        region: d.region,
        povertyRate: d.povertyRate,
        schoolCount: schoolsInDistrict.length,
        totalCandidates,
        averagePassRate: parseFloat(averagePassRate.toFixed(2)),
        meanScore: parseFloat(averageMeanScore.toFixed(2))
      };
    });

    return districts.sort((a, b) => b.averagePassRate - a.averagePassRate);
  }

  // 5. Subject Strength & Weakness Index
  // Identifies which subjects are strongest/weakest for a specific school
  static getSubjectStrengths(schoolId: string, level: ExamLevel, year: number) {
    const perf = YEARLY_PERFORMANCE.find(p => p.schoolId === schoolId && p.year === year && p.level === level);
    if (!perf) return [];

    const subjects = Object.keys(perf.subjectAverages).map(subName => {
      const score = perf.subjectAverages[subName];
      
      // Determine strength classification:
      // For UCE, lower is better (1 is distinction, 9 is fail). Strong is <= 3.0, weak is >= 6.0
      // For UACE, higher is better (5 is A, 0 is F). Strong is >= 3.5, weak is <= 1.5
      let label = "Stable";
      if (level === ExamLevel.UCE) {
        if (score <= 3.0) label = "Strength";
        else if (score >= 5.5) label = "Weakness";
      } else {
        if (score >= 3.2) label = "Strength";
        else if (score <= 1.8) label = "Weakness";
      }

      return {
        subjectName: subName,
        averageScore: score,
        label
      };
    });

    return subjects.sort((a, b) => {
      // Sort so strongest are at the top
      return level === ExamLevel.UCE ? a.averageScore - b.averageScore : b.averageScore - a.averageScore;
    });
  }

  // 6. Predict future performance using simple linear regression (y = mx + b)
  // Forecasts performance for 2026 based on 2015-2025 performance
  static predictPerformance(schoolId: string, level: ExamLevel) {
    const perfs = YEARLY_PERFORMANCE.filter(p => p.schoolId === schoolId && p.level === level)
      .sort((a, b) => a.year - b.year);

    if (perfs.length < 3) return null;

    const n = perfs.length;
    const x = perfs.map(p => p.year);
    const yPassRate = perfs.map(p => p.passRate);
    const yMeanScore = perfs.map(p => p.meanScore);

    const calcRegression = (xArr: number[], yArr: number[]) => {
      const sumX = xArr.reduce((a, b) => a + b, 0);
      const sumY = yArr.reduce((a, b) => a + b, 0);
      const sumXY = xArr.reduce((sum, val, i) => sum + val * yArr[i], 0);
      const sumXX = xArr.reduce((sum, val) => sum + val * val, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      return { slope, intercept };
    };

    const passReg = calcRegression(x, yPassRate);
    const scoreReg = calcRegression(x, yMeanScore);

    const nextYear = 2026;
    const predictedPassRate = Math.min(100, Math.max(0, passReg.slope * nextYear + passReg.intercept));
    const predictedMeanScore = Math.max(1.0, Math.min(20, scoreReg.slope * nextYear + scoreReg.intercept));

    // Calculate R-squared or basic confidence level based on slope steepness & standard error
    const trend = passReg.slope > 0.5 ? "Improving" : passReg.slope < -0.5 ? "Declining" : "Stable";

    return {
      schoolId,
      level,
      forecastYear: nextYear,
      predictedPassRate: parseFloat(predictedPassRate.toFixed(2)),
      predictedMeanScore: parseFloat(predictedMeanScore.toFixed(2)),
      trendSlope: parseFloat(passReg.slope.toFixed(3)),
      trendTrend: trend,
      confidence: passReg.slope === 0 ? "Low" : Math.abs(passReg.slope) > 3.0 ? "Moderate (Volatile)" : "High"
    };
  }

  // 7. National-level aggregate statistics per year
  static getNationalStats(year: number, level: ExamLevel) {
    const perfs = YEARLY_PERFORMANCE.filter(p => p.year === year && p.level === level);
    if (perfs.length === 0) return null;

    const totalSchools = new Set(perfs.map(p => p.schoolId)).size;
    const totalCandidates = perfs.reduce((sum, p) => sum + p.totalCandidates, 0);
    const totalDiv1 = perfs.reduce((sum, p) => sum + p.divisions.div1Or3Prin, 0);
    const totalDiv2 = perfs.reduce((sum, p) => sum + p.divisions.div2Or2Prin, 0);
    const totalDiv3 = perfs.reduce((sum, p) => sum + p.divisions.div3Or1Prin, 0);
    const totalDiv4 = perfs.reduce((sum, p) => sum + p.divisions.div4Or0Prin, 0);
    const totalFail = perfs.reduce((sum, p) => sum + p.divisions.divUOrFail, 0);
    const totalAbsent = perfs.reduce((sum, p) => sum + p.divisions.divX, 0);

    const nationalPassRate = ((totalCandidates - totalFail - totalAbsent) / totalCandidates) * 100;

    // Calculate subject-level averages nationally
    const subjectAverages: { [sub: string]: { sum: number; count: number } } = {};
    perfs.forEach(p => {
      Object.keys(p.subjectAverages).forEach(sub => {
        if (!subjectAverages[sub]) subjectAverages[sub] = { sum: 0, count: 0 };
        subjectAverages[sub].sum += p.subjectAverages[sub];
        subjectAverages[sub].count += 1;
      });
    });

    const nationalSubjectAverages = Object.keys(subjectAverages).map(sub => ({
      subjectName: sub,
      averageScore: parseFloat((subjectAverages[sub].sum / subjectAverages[sub].count).toFixed(2))
    }));

    return {
      year,
      level,
      totalSchools,
      totalCandidates,
      nationalPassRate: parseFloat(nationalPassRate.toFixed(2)),
      divisions: {
        div1Or3Prin: totalDiv1,
        div2Or2Prin: totalDiv2,
        div3Or1Prin: totalDiv3,
        div4Or0Prin: totalDiv4,
        divUOrFail: totalFail,
        divX: totalAbsent
      },
      subjectAverages: nationalSubjectAverages
    };
  }

  // 8. Find outlier schools (either improved > 15% or dropped > 15% over the years)
  static getOutlierSchools(level: ExamLevel) {
    const outliers: any[] = [];
    SCHOOLS.forEach(school => {
      const perfs = YEARLY_PERFORMANCE.filter(p => p.schoolId === school.id && p.level === level)
        .sort((a, b) => a.year - b.year);

      if (perfs.length < 5) return;

      const first = perfs[0];
      const last = perfs[perfs.length - 1];
      const diff = last.passRate - first.passRate;

      if (Math.abs(diff) >= 8) {
        outliers.push({
          schoolId: school.id,
          name: school.name,
          districtName: school.districtName,
          region: school.region,
          startPassRate: first.passRate,
          endPassRate: last.passRate,
          difference: parseFloat(diff.toFixed(2)),
          type: diff > 0 ? "Outstanding Improver" : "Needs Support (Declining)"
        });
      }
    });

    return outliers.sort((a, b) => b.difference - a.difference);
  }
}
