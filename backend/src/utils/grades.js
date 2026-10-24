// Academic grades, lowest to highest. An internal 2nd examiner must hold a higher grade than the subject lecturer.
export const GRADES = [
  { level: 1, label: 'Lecturer (Probationary)' },
  { level: 2, label: 'Lecturer' },
  { level: 3, label: 'Senior Lecturer Grade II' },
  { level: 4, label: 'Senior Lecturer Grade I' },
  { level: 5, label: 'Professor' },
];

export const gradeLabel = (level) => GRADES.find((g) => g.level === Number(level))?.label ?? null;
