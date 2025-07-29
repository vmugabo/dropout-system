import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Profile({ profile }) {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [activeTab, setActiveTab] = useState('attendance');

  useEffect(() => {
    loadInitialData();
  }, [profile]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentDetails(selectedStudent);
    }
  }, [selectedStudent]);

  const loadInitialData = async () => {
    try {
      if (profile.role === 'head') {
        await loadHeadData();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadHeadData = async () => {
    // Load schools in district
    const { data: schoolsData } = await supabase
      .from('school')
      .select('*')
      .eq('district_id', profile.district_id);
    setSchools(schoolsData || []);

    // Load all classes in district
    const schoolIds = (schoolsData || []).map(s => s.id);
    if (schoolIds.length > 0) {
      const { data: classesData } = await supabase
        .from('class')
        .select('*')
        .in('school_id', schoolIds);
      setClasses(classesData || []);

      // Load all students in district
      const { data: studentsData } = await supabase
        .from('student')
        .select('*, class:class_id(name), school:school_id(name)')
        .in('school_id', schoolIds);
      setStudents(studentsData || []);
    }
  };



  const loadStudentDetails = async (studentId) => {
    setLoading(true);
    try {
      // Load student details (head users can access all students)
      const { data: studentData, error: studentError } = await supabase
        .from('student')
        .select('*, class:class_id(name), school:school_id(name)')
        .eq('id', studentId)
        .single();

      if (studentError) {
        console.error('Error loading student details:', studentError);
        setLoading(false);
        return;
      }

      setStudentDetails(studentData);

      // Load attendance history
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(30);
      
      if (attendanceError) {
        console.error('Error loading attendance:', attendanceError);
      } else {
        setAttendanceHistory(attendanceData || []);
      }

      // Load alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('alert')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (alertsError) {
        console.error('Error loading alerts:', alertsError);
      } else {
        setAlerts(alertsData || []);
      }

      // Load interventions (placeholder - would need intervention table)
      setInterventions([
        {
          id: 1,
          type: 'Parent Contact',
          date: '2024-01-15',
          description: 'Called parent to discuss attendance issues',
          outcome: 'Parent committed to ensuring regular attendance'
        },
        {
          id: 2,
          type: 'Counseling Session',
          date: '2024-01-20',
          description: 'One-on-one meeting with student',
          outcome: 'Student identified personal challenges affecting attendance'
        }
      ]);
    } catch (error) {
      console.error('Error loading student details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student.id);
  };

  const calculateAttendanceRate = () => {
    if (!attendanceHistory.length) return 0;
    const present = attendanceHistory.filter(a => a.present).length;
    return Math.round((present / attendanceHistory.length) * 100);
  };

  const getRiskLevel = () => {
    const rate = calculateAttendanceRate();
    if (rate < 70) return { level: 'high', color: '#c62828', background: '#ffebee' };
    if (rate < 85) return { level: 'medium', color: '#ed6c02', background: '#fff3e0' };
    return { level: 'low', color: '#2e7d32', background: '#e8f5e9' };
  };

  const filteredStudents = students.filter(student => {
    // Apply filters for district officials
    if (selectedSchoolId && student.school_id !== selectedSchoolId) return false;
    if (selectedClassId && student.class_id !== selectedClassId) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '24px', color: '#1a1a1a' }}>
        👤 Student Profile Management
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
        {/* Left Column - Student List */}
        <div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
              📋 Student Directory
            </h3>

            {/* Filters */}
            <div style={{ marginBottom: '16px' }}>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">All Schools</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">All Classes</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            {/* Student List */}
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {filteredStudents.map(student => (
                <div
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  style={{
                    padding: '12px',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: selectedStudent === student.id ? '#e3f2fd' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>{student.name}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {student.class?.name} • {student.school?.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Student Details */}
        <div>
          {selectedStudent && studentDetails ? (
            <div>
              {/* Student Header */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: '#1976d2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '24px',
                    fontWeight: '600',
                    marginRight: '16px'
                  }}>
                    {studentDetails.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px', color: '#1a1a1a' }}>
                      {studentDetails.name}
                    </h2>
                    <p style={{ color: '#666', margin: 0 }}>
                      {studentDetails.class?.name} • {studentDetails.school?.name}
                    </p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#1976d2' }}>
                      {calculateAttendanceRate()}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Attendance Rate</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#ed6c02' }}>
                      {alerts.length}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Alerts</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#2e7d32' }}>
                      {interventions.length}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Interventions</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: getRiskLevel().background, borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: getRiskLevel().color }}>
                      {getRiskLevel().level.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Risk Level</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', marginBottom: '24px' }}>
                <button
                  onClick={() => setActiveTab('attendance')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: '#1976d2',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0'
                  }}
                >
                  📊 Attendance History
                </button>
                <button
                  onClick={() => setActiveTab('alerts')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: '#ed6c02',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0'
                  }}
                >
                  ⚠️ Alerts
                </button>
                <button
                  onClick={() => setActiveTab('interventions')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: '#2e7d32',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0'
                  }}
                >
                  🎯 Interventions
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {activeTab === 'attendance' && (
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
                      Attendance History (Last 30 Days)
                    </h3>
                    {attendanceHistory.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #eee' }}>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Date</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceHistory.map(record => (
                              <tr key={record.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '12px' }}>
                                  {new Date(record.date).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: record.present ? '#e8f5e9' : '#ffebee',
                                    color: record.present ? '#2e7d32' : '#c62828'
                                  }}>
                                    {record.present ? 'Present' : 'Absent'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        No attendance records found
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
                      Student Alerts
                    </h3>
                    {alerts.length > 0 ? (
                      <div>
                        {alerts.map(alert => (
                          <div key={alert.id} style={{
                            padding: '16px',
                            border: '1px solid #ffcdd2',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            background: '#ffebee'
                          }}>
                            <div style={{ fontWeight: '500', marginBottom: '8px', color: '#c62828' }}>
                              {alert.reason}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                              Created: {new Date(alert.created_at).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              Status: {alert.status || 'Active'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        No alerts for this student
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'interventions' && (
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
                      Intervention History
                    </h3>
                    {interventions.length > 0 ? (
                      <div>
                        {interventions.map(intervention => (
                          <div key={intervention.id} style={{
                            padding: '16px',
                            border: '1px solid #c8e6c9',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            background: '#f1f8e9'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ fontWeight: '500', color: '#2e7d32' }}>
                                {intervention.type}
                              </div>
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                {intervention.date}
                              </div>
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                              {intervention.description}
                            </div>
                            <div style={{ fontSize: '14px', color: '#2e7d32', fontWeight: '500' }}>
                              Outcome: {intervention.outcome}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        No interventions recorded
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ 
              background: '#fff', 
              borderRadius: '12px', 
              padding: '80px 24px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#1a1a1a' }}>
                Select a Student
              </h3>
              <p style={{ color: '#666', margin: 0 }}>
                Choose a student from the list to view their detailed profile
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

 