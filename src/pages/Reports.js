import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

function getWeek(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const firstJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - firstJan) / (24 * 60 * 60 * 1000));
  return year + '-W' + String(Math.ceil((days + firstJan.getDay() + 1) / 7)).padStart(2, '0');
}

function toCSV(rows, headers) {
  const escape = v => '"' + String(v).replace(/"/g, '""') + '"';
  return [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h] ?? '')).join(','))].join('\n');
}

export default function Reports({ profile }) {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [missedInfo, setMissedInfo] = useState({});
  const [classes, setClasses] = useState([]);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [districtSchools, setDistrictSchools] = useState([]);
  const [districtClasses, setDistrictClasses] = useState([]);
  const [districtStudents, setDistrictStudents] = useState([]);
  const [districtAvgAttendance, setDistrictAvgAttendance] = useState(0);
  const [districtAtRiskCount, setDistrictAtRiskCount] = useState(0);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolSummaries, setSchoolSummaries] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [schoolAttendanceRates, setSchoolAttendanceRates] = useState([]);
  const [districtName, setDistrictName] = useState('');
  const [showAtRiskModal, setShowAtRiskModal] = useState(false);
  const [atRiskDetails, setAtRiskDetails] = useState([]);
  const [atRiskLoading, setAtRiskLoading] = useState(false);

  // Teacher quick stats and attendance rates by class
  const [teacherStats, setTeacherStats] = useState({ totalClasses: 0, totalStudents: 0, avgAttendance: 0, atRisk: 0, classRates: [] });

  // Fetch classes taught by the teacher for the class dropdown
  useEffect(() => {
    if (profile.role === 'teacher' && profile.school_id && profile.id) {
      supabase
        .from('class')
        .select('id, name, teacher_id')
        .eq('school_id', profile.school_id)
        .eq('teacher_id', profile.id)
        .then(({ data, error }) => {
          console.log('Teacher classes:', data, error);
          setClasses(data || []);
        });
    }
  }, [profile.role, profile.school_id, profile.id]);

  // Fetch students for the selected class
  useEffect(() => {
    if (filterClassId) {
      supabase
        .from('student')
        .select('*')
        .eq('class_id', filterClassId)
        .then(({ data, error }) => {
          console.log('Fetched students:', data, error);
          setStudents(data || []);
        });
    } else {
      setStudents([]);
    }
  }, [filterClassId]);

  // Fetch attendance and alerts for students in the selected class
  useEffect(() => {
    if (students.length === 0) {
      setAttendance([]);
      setAlerts([]);
      return;
    }
    const studentIds = students.map(s => s.id);
    supabase
      .from('attendance')
      .select('*')
      .in('student_id', studentIds)
      .then(async ({ data, error }) => {
        let filtered = data || [];
        if (filterStart) filtered = filtered.filter(a => a.date >= filterStart);
        if (filterEnd) filtered = filtered.filter(a => a.date <= filterEnd);
        setAttendance(filtered);
        console.log('Fetched attendance:', filtered, error);
      });
    supabase
      .from('alert')
      .select('*, student:student_id(name, class_id, school_id)')
      .in('student_id', studentIds)
      .then(({ data, error }) => {
        setAlerts(data || []);
        console.log('Fetched alerts:', data, error);
      });
  }, [students, filterStart, filterEnd]);

  // Fetch missed days for flagged students (teacher view)
  useEffect(() => {
    async function fetchMissed() {
      const missed = {};
      for (const alert of alerts) {
        const { data: att } = await supabase
          .from('attendance')
          .select('date')
          .eq('student_id', alert.student_id)
          .eq('present', false);
        missed[alert.student_id] = att ? att.map(a => a.date) : [];
      }
      setMissedInfo(missed);
    }
    if (alerts.length > 0 && profile.role === 'teacher') fetchMissed();
  }, [alerts, profile.role]);

  // Attendance summary and trend
  const summary = students.map(student => {
    const studentAttendance = attendance.filter(a => a.student_id === student.id);
    const daysPresent = studentAttendance.filter(a => a.present).length;
    const daysAbsent = studentAttendance.filter(a => !a.present).length;
    const percent = studentAttendance.length > 0 ? Math.round((daysPresent / studentAttendance.length) * 100) : 0;
    return { id: student.id, name: student.name, class: student.class_id, daysPresent, daysAbsent, percent };
  });

  const trend = {};
  if (filterClassId) {
    const classAttendance = attendance.filter(a => students.some(s => s.id === a.student_id));
    const weeklyData = {};
    classAttendance.forEach(record => {
      const week = getWeek(record.date);
      if (!weeklyData[week]) weeklyData[week] = { present: 0, total: 0 };
      weeklyData[week].total++;
      if (record.present) weeklyData[week].present++;
    });
    trend[filterClassId] = weeklyData;
  }

  // Head user data loading
  useEffect(() => {
    if (profile.role === 'head' && profile.district_id) {
      async function fetchSchoolsAndStats() {
        // Fetch all schools in the district
        const { data: schools } = await supabase
          .from('school')
          .select('id, name')
          .eq('district_id', profile.district_id);
        setDistrictSchools(schools || []);

        // Fetch district name
        const { data: district } = await supabase
          .from('district')
          .select('name')
          .eq('id', profile.district_id)
          .single();
        setDistrictName(district?.name || '');

        // Fetch all classes in the district
        const schoolIds = (schools || []).map(s => s.id);
        if (schoolIds.length > 0) {
          const { data: classes } = await supabase
            .from('class')
            .select('id, name, school_id')
            .in('school_id', schoolIds);
          setDistrictClasses(classes || []);

          // Fetch all students in the district
          const { data: students } = await supabase
            .from('student')
            .select('id, name, class_id, school_id')
            .in('school_id', schoolIds);
          setDistrictStudents(students || []);

          // Calculate district average attendance
          if (students && students.length > 0) {
            const studentIds = students.map(s => s.id);
            const { data: attendance } = await supabase
              .from('attendance')
              .select('present')
              .in('student_id', studentIds);
            const totalRecords = attendance?.length || 0;
            const presentRecords = attendance?.filter(a => a.present).length || 0;
            const avgAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
            setDistrictAvgAttendance(avgAttendance);
          }

          // Calculate district at-risk count
          const { data: alerts } = await supabase
            .from('alert')
            .select('student_id')
            .in('school_id', schoolIds);
          setDistrictAtRiskCount(alerts?.length || 0);

          // Fetch school attendance rates
          async function fetchSchoolAttendanceRates() {
            const rates = [];
            for (const school of schools) {
              const { data: schoolStudents } = await supabase
                .from('student')
                .select('id')
                .eq('school_id', school.id);
              if (schoolStudents && schoolStudents.length > 0) {
                const studentIds = schoolStudents.map(s => s.id);
                const { data: schoolAttendance } = await supabase
                  .from('attendance')
                  .select('present')
                  .in('student_id', studentIds);
                const totalRecords = schoolAttendance?.length || 0;
                const presentRecords = schoolAttendance?.filter(a => a.present).length || 0;
                const percent = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
                rates.push({ schoolName: school.name, percent });
              }
            }
            setSchoolAttendanceRates(rates);
          }
          fetchSchoolAttendanceRates();
        }
      }
      fetchSchoolsAndStats();
    }
  }, [profile.role, profile.district_id]);

  // Teacher stats loading
  useEffect(() => {
    if (profile.role === 'teacher' && profile.school_id && profile.id) {
      async function fetchTeacherStats() {
        // Fetch teacher's classes
        const { data: teacherClasses } = await supabase
          .from('class')
          .select('id, name')
          .eq('school_id', profile.school_id)
          .eq('teacher_id', profile.id);
        
        if (teacherClasses && teacherClasses.length > 0) {
          const classIds = teacherClasses.map(c => c.id);
          
          // Fetch students in teacher's classes
          const { data: teacherStudents } = await supabase
            .from('student')
            .select('id, class_id')
            .in('class_id', classIds);
          
          // Calculate attendance rates by class
          const classRates = [];
          for (const cls of teacherClasses) {
            const classStudents = teacherStudents?.filter(s => s.class_id === cls.id) || [];
            if (classStudents.length > 0) {
              const studentIds = classStudents.map(s => s.id);
              const { data: classAttendance } = await supabase
                .from('attendance')
                .select('present')
                .in('student_id', studentIds);
              const totalRecords = classAttendance?.length || 0;
              const presentRecords = classAttendance?.filter(a => a.present).length || 0;
              const percent = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
              classRates.push({ className: cls.name, percent });
            }
          }

          // Calculate overall stats
          const totalStudents = teacherStudents?.length || 0;
          const studentIds = teacherStudents?.map(s => s.id) || [];
          const { data: overallAttendance } = await supabase
            .from('attendance')
            .select('present')
            .in('student_id', studentIds);
          const totalRecords = overallAttendance?.length || 0;
          const presentRecords = overallAttendance?.filter(a => a.present).length || 0;
          const avgAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

          // Count at-risk students
          const { data: teacherAlerts } = await supabase
            .from('alert')
            .select('student_id')
            .in('student_id', studentIds);
          const atRiskCount = teacherAlerts?.length || 0;

          setTeacherStats({
            totalClasses: teacherClasses.length,
            totalStudents,
            avgAttendance,
            atRisk: atRiskCount,
            classRates
          });
        }
      }
      fetchTeacherStats();
    }
  }, [profile.role, profile.school_id, profile.id]);

  const getClassName = (id) => {
    const cls = classes.find(c => c.id === id);
    return cls ? cls.name : '';
  };

  // Export to CSV
  function handleExport() {
    const headers = ['Student Name', 'Class', 'Days Present', 'Days Absent', 'Attendance %'];
    const rows = summary.map(s => ({
      'Student Name': s.name,
      'Class': getClassName(s.class),
      'Days Present': s.daysPresent,
      'Days Absent': s.daysAbsent,
      'Attendance %': s.percent
    }));
    const csv = toCSV(rows, headers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  const exportClassAttendance = async (classId, className) => {
    try {
      // Get students in the specific class
      const { data: classStudents } = await supabase
        .from('student')
        .select('id, name')
        .eq('class_id', classId);

      if (!classStudents || classStudents.length === 0) {
        alert('No students found in this class');
        return;
      }

      const studentIds = classStudents.map(s => s.id);
      
      // Get attendance data for these students
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .in('student_id', studentIds);

      // Calculate attendance summary for each student
      const attendanceSummary = classStudents.map(student => {
        const studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
        const daysPresent = studentAttendance.filter(a => a.present).length;
        const daysAbsent = studentAttendance.filter(a => !a.present).length;
        const totalDays = daysPresent + daysAbsent;
        const attendanceRate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

        return {
          'Student Name': student.name,
          'Days Present': daysPresent,
          'Days Absent': daysAbsent,
          'Total Days': totalDays,
          'Attendance Rate (%)': attendanceRate
        };
      });

      // Create CSV
      const headers = ['Student Name', 'Days Present', 'Days Absent', 'Total Days', 'Attendance Rate (%)'];
      const csv = toCSV(attendanceSummary, headers);
      
      // Download file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${className}_attendance.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting class attendance:', error);
      alert('Error exporting attendance data. Please try again.');
    }
  };

  async function fetchAtRiskDetails() {
    setAtRiskLoading(true);
    try {
      if (profile.role === 'head') {
        // For head users, fetch all at-risk students in the district
        const schoolIds = districtSchools.map(s => s.id);
        if (schoolIds.length > 0) {
          const { data } = await supabase
            .from('alert')
            .select('*, student:student_id(name, class_id, school_id, school:school_id(name), class:class_id(name))')
            .in('school_id', schoolIds);
          setAtRiskDetails(data || []);
        }
      } else {
        // For teachers, fetch at-risk students in their school
        const { data } = await supabase
          .from('alert')
          .select('*, student:student_id(name, class_id, school_id, school:school_id(name), class:class_id(name))')
          .eq('school_id', profile.school_id);
        setAtRiskDetails(data || []);
      }
    } catch (error) {
      console.error('Error fetching at-risk details:', error);
    } finally {
      setAtRiskLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: 'auto', marginTop: 40, padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
      <h2 style={{ marginBottom: 24 }}>
        {profile.role === 'head' ? 'General Outlook for the District' : 'Attendance Summary'}
      </h2>
      <div style={{ marginBottom: 24, fontWeight: 600, fontSize: 18 }}>
        {profile.role === 'head'
          ? `District: ${districtName || 'Loading...'}`
          : `School: ${schoolName || 'Loading...'}`}
      </div>
      {profile.role === 'head' && (
        <>
          {/* Quick Stats Cards at the very top */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
            <div style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Total Schools<br />{districtSchools.length}
            </div>
            <div style={{ background: '#388e3c', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Total Students<br />{districtStudents.length}
            </div>
            <div style={{ background: '#f57c00', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              District Avg Attendance<br />{districtAvgAttendance}%
            </div>
            <div
              style={{ background: '#c62828', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600, cursor: 'pointer', boxShadow: showAtRiskModal ? '0 0 0 3px #c6282880' : undefined }}
              onClick={() => { setShowAtRiskModal(true); fetchAtRiskDetails(); }}
              title="Click to view details of students at risk"
            >
              Students at Risk<br />{districtAtRiskCount}
            </div>
          </div>
          {/* Attendance Rates by School next */}
          {schoolAttendanceRates.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12 }}>Attendance Rates by School</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>School</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolAttendanceRates.map(school => (
                    <tr key={school.schoolName}>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{school.schoolName}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{school.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* School and Class Filters and Attendance Summary follow */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <label>School:&nbsp;</label>
              <select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                <option value=''>Select school</option>
                {districtSchools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Class:&nbsp;</label>
              <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                <option value=''>Select class</option>
                {districtClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Start Date:&nbsp;</label>
              <input type='date' value={filterStart} onChange={e => setFilterStart(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }} />
            </div>
            <div>
              <label>End Date:&nbsp;</label>
              <input type='date' value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }} />
            </div>
            <button onClick={handleExport} style={{ marginLeft: 16, padding: '8px 16px', border: 'none', borderRadius: 4, background: '#1976d2', color: '#fff', fontWeight: 600, cursor: 'pointer' }} disabled={!filterClassId}>Export CSV</button>
            <button onClick={handlePrint} style={{ marginLeft: 8, padding: '8px 16px', border: 'none', borderRadius: 4, background: '#388e3c', color: '#fff', fontWeight: 600, cursor: 'pointer' }} disabled={!filterClassId}>Print</button>
          </div>
        </>
      )}
      {profile.role === 'teacher' && (
        <>
          {/* Quick Stats Cards */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
            <div style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Total Classes<br />{teacherStats.totalClasses}
            </div>
            <div style={{ background: '#388e3c', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Total Students<br />{teacherStats.totalStudents}
            </div>
            <div style={{ background: '#f57c00', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Avg Attendance<br />{teacherStats.avgAttendance}%
            </div>
            <div style={{ background: '#c62828', color: '#fff', borderRadius: 8, padding: 16, minWidth: 160, textAlign: 'center', fontWeight: 600 }}>
              Students at Risk<br />{teacherStats.atRisk}
            </div>
          </div>
          {/* Attendance Rates by Class */}
          {teacherStats.classRates.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12 }}>Attendance Rates by Class</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Class</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Attendance %</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStats.classRates.map(cls => {
                    // Find the class object to get its id
                    const classObj = classes.find(c => c.name === cls.className);
                    const isSelected = filterClassId === classObj?.id;
                    return (
                      <tr key={cls.className} style={isSelected ? { background: '#e3f2fd' } : {}}>
                        <td
                          style={{ padding: 8, border: '1px solid #eee', color: '#1976d2', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => classObj && setFilterClassId(classObj.id)}
                          title="Click to view details for this class"
                        >
                          {cls.className}
                        </td>
                        <td style={{ padding: 8, border: '1px solid #eee' }}>{cls.percent}%</td>
                        <td style={{ padding: 8, border: '1px solid #eee' }}>
                          <button
                            onClick={() => classObj && exportClassAttendance(classObj.id, cls.className)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              borderRadius: 4,
                              background: '#1976d2',
                              color: '#fff',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                            title={`Download ${cls.className} attendance data as CSV`}
                          >
                            📥 CSV
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Class Dropdown */}
          <div style={{ marginBottom: 24 }}>
            <label>Class:&nbsp;</label>
            <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
              <option value=''>Select class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 12 }}>{filterClassId ? `Class: ${getClassName(filterClassId)}` : ''}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Student Name</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Class</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Days Present</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Days Absent</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(s => (
              <tr key={s.id}>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{s.name}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{getClassName(s.class)}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{s.daysPresent}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{s.daysAbsent}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{s.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Attendance Trend Bar Chart */}
        {trend[filterClassId] && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ marginBottom: 8 }}>Attendance Trend (by week)</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, borderLeft: '2px solid #ccc', borderBottom: '2px solid #ccc', paddingLeft: 8 }}>
              {Object.entries(trend[filterClassId]).sort(([a], [b]) => a.localeCompare(b)).map(([week, val]) => {
                const percent = val.total > 0 ? Math.round((val.present / val.total) * 100) : 0;
                return (
                  <div key={week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                    <div style={{ height: percent, width: 24, background: '#1976d2', borderRadius: 4, marginBottom: 4, transition: 'height 0.3s' }} title={`Week: ${week}\nAttendance: ${percent}%`} />
                    <span style={{ fontSize: 11, color: '#333', writingMode: 'vertical-lr', textAlign: 'center' }}>{week.split('-W')[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* At Risk Students Modal */}
      {showAtRiskModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 400, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 32px #0003', position: 'relative' }}>
            <button onClick={() => setShowAtRiskModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 18 }}>×</button>
            <h2 style={{ marginBottom: 16 }}>Students at Risk - Details</h2>
            {atRiskLoading ? (
              <div>Loading...</div>
            ) : atRiskDetails.length === 0 ? (
              <div>No students at risk found in the district.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Student Name</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Reason</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Class</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>School</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskDetails.map((alert, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.student?.name}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.reason}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.student?.class?.name}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.student?.school?.name}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>
                        {new Date(alert.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {profile.role === 'teacher' && alerts.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ margin: '0 0 24px 0' }}>Flagged Students (Dropout Risk)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption style={{ captionSide: 'top', fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>
              Students flagged as at risk of dropout (3 consecutive absences)
            </caption>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Student Name</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Reason</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Days Missed</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Missed Dates</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(alert => (
                <tr key={alert.id}>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.student?.name}</td>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>{alert.reason}</td>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>{missedInfo[alert.student_id]?.length || 0}</td>
                  <td style={{ padding: 8, border: '1px solid #eee', fontSize: 13 }}>
                    {missedInfo[alert.student_id]?.map(date => (
                      <span key={date} style={{ display: 'inline-block', marginRight: 4 }}>{date}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {profile.role === 'teacher' && filterClassId && students.length === 0 && (
        <div style={{ margin: '32px 0', color: '#c62828', fontWeight: 600 }}>No students found for this class.</div>
      )}
      {profile.role === 'teacher' && filterClassId && students.length > 0 && attendance.length === 0 && (
        <div style={{ margin: '32px 0', color: '#c62828', fontWeight: 600 }}>No attendance records found for students in this class.</div>
      )}
      {profile.role === 'teacher' && filterClassId && students.length > 0 && alerts.length === 0 && (
        <div style={{ margin: '32px 0', color: '#c62828', fontWeight: 600 }}>No flagged students found for this class.</div>
      )}
    </div>
  );
} 