import { School, District, Subject, SchoolYearlyPerformance, CandidateRecord, Region, ExamLevel } from "../types";

export const DISTRICTS: District[] = [
  { id: "d_wakiso", name: "Wakiso", region: Region.CENTRAL, povertyRate: 12.4, schoolCount: 145 },
  { id: "d_kampala", name: "Kampala", region: Region.CENTRAL, povertyRate: 8.2, schoolCount: 210 },
  { id: "d_mukono", name: "Mukono", region: Region.CENTRAL, povertyRate: 15.1, schoolCount: 98 },
  { id: "d_mbarara", name: "Mbarara", region: Region.WESTERN, povertyRate: 16.5, schoolCount: 82 },
  { id: "d_gulu", name: "Gulu", region: Region.NORTHERN, povertyRate: 34.2, schoolCount: 45 },
  { id: "d_jinja", name: "Jinja", region: Region.EASTERN, povertyRate: 22.8, schoolCount: 64 }
];

export const SCHOOLS: School[] = [
  { id: "s_budo", name: "King's College Budo", districtId: "d_wakiso", districtName: "Wakiso", region: Region.CENTRAL, ownership: "Government", gender: "Co-Ed", foundedYear: 1906 },
  { id: "s_kitende", name: "St Mary's Boarding SS, Kitende", districtId: "d_wakiso", districtName: "Wakiso", region: Region.CENTRAL, ownership: "Private", gender: "Co-Ed", foundedYear: 2001 },
  { id: "s_gayaza", name: "Gayaza High School", districtId: "d_wakiso", districtName: "Wakiso", region: Region.CENTRAL, ownership: "Government", gender: "Girls Only", foundedYear: 1905 },
  { id: "s_ntare", name: "Ntare School", districtId: "d_mbarara", districtName: "Mbarara", region: Region.WESTERN, ownership: "Government", gender: "Boys Only", foundedYear: 1956 },
  { id: "s_namagunga", name: "Mt St Mary's College, Namagunga", districtId: "d_mukono", districtName: "Mukono", region: Region.CENTRAL, ownership: "Government", gender: "Girls Only", foundedYear: 1942 },
  { id: "s_namugongo", name: "Uganda Martyrs' SS, Namugongo", districtId: "d_wakiso", districtName: "Wakiso", region: Region.CENTRAL, ownership: "Government", gender: "Co-Ed", foundedYear: 1967 },
  { id: "s_kibuli", name: "Kibuli Secondary School", districtId: "d_kampala", districtName: "Kampala", region: Region.CENTRAL, ownership: "Government", gender: "Co-Ed", foundedYear: 1959 },
  { id: "s_mengo", name: "Mengo Senior School", districtId: "d_kampala", districtName: "Kampala", region: Region.CENTRAL, ownership: "Government", gender: "Co-Ed", foundedYear: 1895 },
  { id: "s_gulu", name: "Gulu High School", districtId: "d_gulu", districtName: "Gulu", region: Region.NORTHERN, ownership: "Government", gender: "Co-Ed", foundedYear: 1914 },
  { id: "s_jinja", name: "Jinja College", districtId: "d_jinja", districtName: "Jinja", region: Region.EASTERN, ownership: "Government", gender: "Boys Only", foundedYear: 1946 }
];

export const SUBJECTS: Subject[] = [
  // Sciences
  { name: "Mathematics", code: "MTE", category: "Sciences" },
  { name: "Physics", code: "PHY", category: "Sciences" },
  { name: "Chemistry", code: "CHE", category: "Sciences" },
  { name: "Biology", code: "BIO", category: "Sciences" },
  // Humanities
  { name: "History", code: "HIS", category: "Humanities" },
  { name: "Geography", code: "GEO", category: "Humanities" },
  { name: "Literature", code: "LIT", category: "Languages" },
  { name: "English", code: "ENG", category: "Languages" },
  { name: "Fine Art", code: "ART", category: "Vocational" },
  { name: "General Paper", code: "GPP", category: "Humanities" }
];

// Helper to generate deterministic yearly records
function generateYearlyPerformance(): SchoolYearlyPerformance[] {
  const records: SchoolYearlyPerformance[] = [];
  const years = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015 to 2025

  SCHOOLS.forEach(school => {
    years.forEach(year => {
      // Create UCE Performance
      const uceCandidates = 100 + Math.round((school.foundedYear % 150) + Math.sin(year) * 20);
      
      // Calculate quality factors based on prestige and ownership
      let baselineQuality = 0.75; // general baseline for public giants
      if (school.id === "s_kitende" || school.id === "s_namugongo") baselineQuality = 0.94;
      if (school.id === "s_budo" || school.id === "s_gayaza" || school.id === "s_namagunga") baselineQuality = 0.90;
      if (school.id === "s_ntare") baselineQuality = 0.85;
      if (school.id === "s_gulu") baselineQuality = 0.52; // Northern region recovers, lower base but improving
      
      // Let's add positive trends over years with a slight dip during COVID-19 (2020-2021)
      let yearFactor = (year - 2015) * 0.012;
      if (year === 2020 || year === 2021) yearFactor -= 0.05; // covid effect
      
      const uceDiv1Percent = Math.min(0.99, Math.max(0.15, baselineQuality + yearFactor + Math.cos(year * 3) * 0.02));
      const uceDiv2Percent = Math.min(1 - uceDiv1Percent, (1 - uceDiv1Percent) * 0.7);
      const uceDiv3Percent = Math.min(1 - uceDiv1Percent - uceDiv2Percent, (1 - uceDiv1Percent - uceDiv2Percent) * 0.8);
      const uceDiv4Percent = Math.max(0, 1 - uceDiv1Percent - uceDiv2Percent - uceDiv3Percent - 0.01);
      const uceUPercent = Math.max(0, 1 - uceDiv1Percent - uceDiv2Percent - uceDiv3Percent - uceDiv4Percent);
      
      const uceDiv1 = Math.round(uceCandidates * uceDiv1Percent);
      const uceDiv2 = Math.round(uceCandidates * uceDiv2Percent);
      const uceDiv3 = Math.round(uceCandidates * uceDiv3Percent);
      const uceDiv4 = Math.round(uceCandidates * uceDiv4Percent);
      const uceU = Math.round(uceCandidates * uceUPercent);
      const uceX = uceCandidates - (uceDiv1 + uceDiv2 + uceDiv3 + uceDiv4 + uceU);

      // Subject Averages (UCE scale: 1 is best, 9 is worst)
      // High-performing schools have average grade closer to 1.5 - 3.0
      // Lower performing closer to 5.0 - 7.0
      const uceSubjectAverages: { [sub: string]: number } = {};
      SUBJECTS.forEach(sub => {
        let baseSubjectDifficulty = 2.0; // Math/Sciences are generally harder
        if (sub.category === "Sciences") baseSubjectDifficulty = 3.2;
        if (sub.name === "English") baseSubjectDifficulty = 2.5;

        // School strengths
        let strengthBonus = 0;
        if (school.id === "s_budo" && sub.name === "Mathematics") strengthBonus = -0.5;
        if (school.id === "s_ntare" && sub.name === "Physics") strengthBonus = -0.6;
        if (school.id === "s_gayaza" && sub.name === "Biology") strengthBonus = -0.5;
        if (school.id === "s_kitende" && sub.category === "Sciences") strengthBonus = -0.4;
        
        const randomFluctuation = Math.sin(year * sub.code.charCodeAt(0)) * 0.3;
        const avg = Math.min(9.0, Math.max(1.0, 9.0 - (8.0 * uceDiv1Percent) + baseSubjectDifficulty + strengthBonus + randomFluctuation));
        uceSubjectAverages[sub.name] = parseFloat(avg.toFixed(2));
      });

      records.push({
        schoolId: school.id,
        year,
        level: ExamLevel.UCE,
        totalCandidates: uceCandidates,
        divisions: {
          div1Or3Prin: uceDiv1,
          div2Or2Prin: uceDiv2,
          div3Or1Prin: uceDiv3,
          div4Or0Prin: uceDiv4,
          divUOrFail: uceU,
          divX: Math.max(0, uceX)
        },
        meanScore: parseFloat((10.0 - uceDiv1Percent * 7.5 + Math.cos(year) * 0.2).toFixed(2)), // Mean aggregate (best 8, scale where lower is better in actual UNEB, but here let's simplify to a score out of 10)
        passRate: parseFloat(((1 - uceUPercent) * 100).toFixed(1)),
        subjectAverages: uceSubjectAverages
      });

      // Create UACE Performance (Points system, max 20)
      const uaceCandidates = Math.round(uceCandidates * 0.8);
      let baselineUaceQuality = baselineQuality * 1.05; // typical filter effect, remaining candidates are better
      let uace3PrinPercent = Math.min(0.99, Math.max(0.1, baselineUaceQuality - 0.05 + yearFactor + Math.sin(year * 2) * 0.02));
      let uace2PrinPercent = Math.min(1 - uace3PrinPercent, (1 - uace3PrinPercent) * 0.6);
      let uace1PrinPercent = Math.min(1 - uace3PrinPercent - uace2PrinPercent, (1 - uace3PrinPercent - uace2PrinPercent) * 0.8);
      let uace0PrinPercent = Math.max(0, 1 - uace3PrinPercent - uace2PrinPercent - uace1PrinPercent - 0.02);
      let uaceFailPercent = Math.max(0, 1 - uace3PrinPercent - uace2PrinPercent - uace1PrinPercent - uace0PrinPercent);

      const uace3P = Math.round(uaceCandidates * uace3PrinPercent);
      const uace2P = Math.round(uaceCandidates * uace2PrinPercent);
      const uace1P = Math.round(uaceCandidates * uace1PrinPercent);
      const uace0P = Math.round(uaceCandidates * uace0PrinPercent);
      const uaceFail = Math.round(uaceCandidates * uaceFailPercent);
      const uaceX = uaceCandidates - (uace3P + uace2P + uace1P + uace0P + uaceFail);

      const uaceSubjectAverages: { [sub: string]: number } = {};
      SUBJECTS.forEach(sub => {
        // Points: A=5, B=4, C=3, D=2, E=1, O=0.5, F=0
        let baseUaceDifficulty = 1.5; // sciences
        if (sub.category === "Humanities") baseUaceDifficulty = 2.5;
        
        let strengthBonus = 0;
        if (school.id === "s_kitende" && sub.category === "Sciences") strengthBonus = 0.8;
        if (school.id === "s_namugongo" && sub.name === "Mathematics") strengthBonus = 0.9;
        if (school.id === "s_namagunga" && sub.name === "Literature") strengthBonus = 0.7;

        const randomFluctuation = Math.cos(year * sub.code.charCodeAt(0)) * 0.25;
        const avg = Math.min(5.0, Math.max(0.0, (uace3PrinPercent * 4.2) + baseUaceDifficulty + strengthBonus + randomFluctuation));
        uaceSubjectAverages[sub.name] = parseFloat(avg.toFixed(2));
      });

      records.push({
        schoolId: school.id,
        year,
        level: ExamLevel.UACE,
        totalCandidates: uaceCandidates,
        divisions: {
          div1Or3Prin: uace3P,
          div2Or2Prin: uace2P,
          div3Or1Prin: uace1P,
          div4Or0Prin: uace0P,
          divUOrFail: uaceFail,
          divX: Math.max(0, uaceX)
        },
        meanScore: parseFloat((10.0 + uace3PrinPercent * 8.5 + Math.sin(year) * 0.15).toFixed(2)), // Mean UACE points (max 20)
        passRate: parseFloat(((1 - uaceFailPercent) * 100).toFixed(1)),
        subjectAverages: uaceSubjectAverages
      });
    });
  });

  return records;
}

export const YEARLY_PERFORMANCE: SchoolYearlyPerformance[] = generateYearlyPerformance();

// Generates individual high-fidelity candidate logs for student search/profiles
function generateCandidateRecords(): CandidateRecord[] {
  const records: CandidateRecord[] = [];
  const years = [2021, 2022, 2023, 2024, 2025];
  const firstNamesM = ["Faisal", "Moses", "Kizza", "Ivan", "Okot", "Emmanuel", "John", "David", "Ronald", "Mugisha", "Patrick", "Joseph", "Brian"];
  const firstNamesF = ["Zulaika", "Patricia", "Namaganda", "Apio", "Angella", "Nakato", "Babirye", "Mercy", "Elizabeth", "Aisha", "Christine", "Fiona"];
  const lastNames = ["Doka", "Museveni", "Opondo", "Kanyomozi", "Kiiza", "Mbabazi", "Amolo", "Ssewankambo", "Mukasa", "Akol", "Obote", "Mutebi", "Lule", "Kigundu", "Owor"];

  let counter = 1;

  years.forEach(year => {
    SCHOOLS.forEach(school => {
      // 2 UCE and 2 UACE candidates per school per year
      [ExamLevel.UCE, ExamLevel.UACE].forEach(level => {
        for (let i = 0; i < 2; i++) {
          const isFemale = i % 2 === 0;
          const gender = isFemale ? "F" : "M";
          const firstName = isFemale 
            ? firstNamesF[(year + school.name.length + counter) % firstNamesF.length]
            : firstNamesM[(year + school.name.length + counter) % firstNamesM.length];
          const lastName = lastNames[(counter * 3 + school.foundedYear) % lastNames.length];
          const name = `${firstName} ${lastName}`;
          const candidateNumber = `U${(school.foundedYear % 1000).toString().padStart(4, "0")}/${(counter).toString().padStart(3, "0")}`;
          
          let division = "Division 1";
          let score = 12;
          const results: { [s: string]: string } = {};

          if (level === ExamLevel.UCE) {
            // UCE aggregate: 8 is perfect, 72 is worst
            score = 8 + (counter % 15);
            if (school.id === "s_gulu") score += 12;
            if (score <= 18) division = "Division 1";
            else if (score <= 32) division = "Division 2";
            else if (score <= 45) division = "Division 3";
            else division = "Division 4";

            SUBJECTS.filter(s => s.name !== "General Paper").forEach(s => {
              let grade = "C3";
              const scoreFactor = score + s.name.length;
              if (scoreFactor <= 14) grade = "D1";
              else if (scoreFactor <= 18) grade = "D2";
              else if (scoreFactor <= 24) grade = "C3";
              else if (scoreFactor <= 32) grade = "C4";
              else if (scoreFactor <= 40) grade = "C5";
              else if (scoreFactor <= 48) grade = "C6";
              else if (scoreFactor <= 56) grade = "P7";
              else if (scoreFactor <= 64) grade = "P8";
              else grade = "F9";
              results[s.name] = grade;
            });
          } else {
            // UACE points: max 20, higher is better
            score = 20 - (counter % 6);
            if (school.id === "s_gulu") score = Math.max(5, score - 6);
            division = `${score} Points`;

            SUBJECTS.forEach(s => {
              let grade = "B";
              const r = (score + s.name.length) % 6;
              if (r === 5) grade = "A";
              else if (r === 4) grade = "B";
              else if (r === 3) grade = "C";
              else if (r === 2) grade = "D";
              else if (r === 1) grade = "E";
              else grade = "O";
              results[s.name] = grade;
            });
          }

          records.push({
            id: `cand_${year}_${counter}`,
            candidateNumber,
            name,
            schoolId: school.id,
            schoolName: school.name,
            districtName: school.districtName,
            year,
            level,
            gender,
            division,
            aggregateOrPoints: score,
            results
          });

          counter++;
        }
      });
    });
  });

  return records;
}

export const CANDIDATE_RECORDS: CandidateRecord[] = generateCandidateRecords();
