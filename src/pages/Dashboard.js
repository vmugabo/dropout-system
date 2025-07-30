import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard({ profile }) {
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [districtName, setDistrictName] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Analytics data
  const [attendanceTrends, setAttendanceTrends] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalStudents: 0,
    avgAttendanceRate: 0,
    atRiskCount: 0
  });
  const [recentAlerts, setRecentAlerts] = useState([]);

  // Intervention modal state
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [interventionText, setInterventionText] = useState('');
  const [interventionLoading, setInterventionLoading] = useState(false);

  // Attendance data for summary
  const [attendanceData, setAttendanceData] = useState([]);

  // Class selection for attendance summary
  const [selectedClassId, setSelectedClassId] = useState('');

  // Load initial data when profile changes
  useEffect(() => {
    if (profile) {
      loadDashboardData();
    }
  }, [profile]);

  // Load analytics when students and alerts data changes
  useEffect(() => {
    if (students.length > 0 || alerts.length > 0) {
      loadAnalytics();
      loadRecentAlerts();
    }
  }, [students, alerts]);

  // Load attendance data when students change
  useEffect(() => {
    if (students.length > 0) {
      loadAttendanceData();
    }
  }, [students]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      if (profile.role === 'head') {
        await loadHeadDashboard();
      } else if (profile.role === 'teacher') {
        await loadTeacherDashboard();
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHeadDashboard = async () => {
    try {
      // Load schools in district
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('school')
        .select('*')
        .eq('district_id', profile.district_id);
      
      if (schoolsError) {
        console.error('Error loading schools:', schoolsError);
        return;
      }
      
      setSchools(schoolsData || []);

      // Load district name
      const { data: districtData, error: districtError } = await supabase
        .from('district')
        .select('name')
        .eq('id', profile.district_id)
        .single();
      
      if (districtError) {
        console.error('Error loading district:', districtError);
      } else {
        setDistrictName(districtData?.name || '');
      }

      // Load all alerts in district
      const schoolIds = (schoolsData || []).map(s => s.id);
      if (schoolIds.length > 0) {
        const { data: alertsData, error: alertsError } = await supabase
          .from('alert')
          .select('*, student:student_id(name, class_id, school_id, school:school_id(name))')
          .in('school_id', schoolIds);
        
        if (alertsError) {
          console.error('Error loading alerts:', alertsError);
        } else {
          setAlerts(alertsData || []);
        }
      }
    } catch (error) {
      console.error('Error in loadHeadDashboard:', error);
    }
  };

  const loadTeacherDashboard = async () => {
    try {
      // Load teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('class')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .eq('teacher_id', profile.id);
      
      if (classesError) {
        console.error('Error loading classes:', classesError);
        return;
      }
      
      setClasses(classesData || []);

      // Load students in teacher's classes
      const classIds = (classesData || []).map(c => c.id);
      let studentsData = [];
      
      if (classIds.length > 0) {
        const { data: studentsResult, error: studentsError } = await supabase
          .from('student')
          .select('*, class:class_id(name), school:school_id(name)')
          .in('class_id', classIds);
        
        if (studentsError) {
          console.error('Error loading students:', studentsError);
        } else {
          studentsData = studentsResult || [];
          setStudents(studentsData);
        }
      }

      // Load alerts for teacher's students
      const studentIds = studentsData.map(s => s.id);
      if (studentIds.length > 0) {
        const { data: alertsData, error: alertsError } = await supabase
          .from('alert')
          .select('*, student:student_id(name, class_id)')
          .in('student_id', studentIds);
        
        if (alertsError) {
          console.error('Error loading alerts:', alertsError);
        } else {
          setAlerts(alertsData || []);
        }
      }
    } catch (error) {
      console.error('Error in loadTeacherDashboard:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) {
        setPerformanceMetrics({
          totalStudents: 0,
          avgAttendanceRate: 0,
          atRiskCount: alerts.length
        });
        return;
      }

      // Calculate attendance rate
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('present')
        .in('student_id', studentIds);

      if (attendanceError) {
        console.error('Error loading attendance:', attendanceError);
        return;
      }

      const totalRecords = attendanceData?.length || 0;
      const presentRecords = attendanceData?.filter(a => a.present).length || 0;
      const avgAttendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;

      setPerformanceMetrics({
        totalStudents: students.length,
        avgAttendanceRate: Math.round(avgAttendanceRate * 10) / 10,
        atRiskCount: alerts.length
      });
    } catch (error) {
      console.error('Error in loadAnalytics:', error);
    }
  };

  const loadRecentAlerts = async () => {
    try {
      // Get the most recent alerts (last 5)
      const recentAlertsData = alerts.slice(0, 5);
      setRecentAlerts(recentAlertsData);
    } catch (error) {
      console.error('Error loading recent alerts:', error);
    }
  };

  const loadAttendanceData = async () => {
    try {
      if (students.length === 0) {
        console.log('No students to load attendance for');
        setAttendanceData([]);
        return;
      }

      const studentIds = students.map(s => s.id);
      console.log('Loading attendance for student IDs:', studentIds);

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .in('student_id', studentIds);

      if (error) {
        console.error('Error loading attendance data:', error);
      } else {
        console.log('Loaded attendance data:', data);
        setAttendanceData(data || []);
      }
    } catch (error) {
      console.error('Error in loadAttendanceData:', error);
    }
  };

  const handleQuickAction = async (alertId, action) => {
    console.log(`Quick action: ${action} for alert ${alertId}`);
  };

  const handleInterventionSubmit = async () => {
    if (!selectedAlert || !interventionText.trim()) {
      alert('Please enter intervention details');
      return;
    }

    setInterventionLoading(true);
    try {
      // Save intervention to database
      const { data, error } = await supabase
        .from('intervention')
        .insert([
          {
            student_id: selectedAlert.student_id,
            alert_id: selectedAlert.id,
            teacher_id: profile.id,
            intervention_type: 'dropout_prevention',
            description: interventionText,
            status: 'active'
          }
        ]);

      if (error) {
        console.error('Error saving intervention:', error);
        alert('Error saving intervention. Please try again.');
      } else {
        alert('Intervention recorded successfully!');
        setShowInterventionModal(false);
        setSelectedAlert(null);
        setInterventionText('');
        // Optionally refresh the alerts data
        loadDashboardData();
      }
    } catch (error) {
      console.error('Error in handleInterventionSubmit:', error);
      alert('Error saving intervention. Please try again.');
    } finally {
      setInterventionLoading(false);
    }
  };

  const openInterventionModal = (alert) => {
    setSelectedAlert(alert);
    setInterventionText('');
    setShowInterventionModal(true);
  };

  const getRiskLevel = (student) => {
    if (!student) return 'low';
    // This is a simplified risk calculation - you can enhance this based on your requirements
    return 'high'; // For now, all students with alerts are considered high risk
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Loading Dashboard...</div>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f3f3', borderTop: '4px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>
          Welcome back, {profile.name}!
        </h1>
        <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
          {profile.role === 'head' ? `District: ${districtName}` : `School Dashboard`}
        </p>
      </div>

      {/* Performance Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <MetricCard
          title="Total Students"
          value={performanceMetrics.totalStudents}
          icon="👥"
          color="#1976d2"
        />
        <MetricCard
          title="Average Attendance"
          value={`${performanceMetrics.avgAttendanceRate}%`}
          icon="📊"
          color="#2e7d32"
        />
        <MetricCard
          title="At-Risk Students"
          value={performanceMetrics.atRiskCount}
          icon="⚠️"
          color="#ed6c02"
        />

      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Left Column */}
        <div>
          {/* At-Risk Students Table */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
              ⚠️ At-Risk Students
            </h3>
            {alerts.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Student</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Class</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Risk Level</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 10).map(alert => (
                      <tr key={alert.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '500' }}>{alert.student?.name}</div>
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {classes.find(c => c.id === alert.student?.class_id)?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: getRiskLevel(alert.student) === 'high' ? '#ffebee' : 
                                       getRiskLevel(alert.student) === 'medium' ? '#fff3e0' : '#e8f5e9',
                            color: getRiskLevel(alert.student) === 'high' ? '#c62828' : 
                                   getRiskLevel(alert.student) === 'medium' ? '#ed6c02' : '#2e7d32'
                          }}>
                            {getRiskLevel(alert.student).toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => handleQuickAction(alert.id, 'contact')}
                            style={{
                              padding: '6px 12px',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#1976d2',
                              color: '#fff',
                              fontSize: '12px',
                              cursor: 'pointer',
                              marginRight: '8px'
                            }}
                          >
                            Contact
                          </button>
                          <button
                            onClick={() => openInterventionModal(alert)}
                            style={{
                              padding: '6px 12px',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#2e7d32',
                              color: '#fff',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Intervene
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No at-risk students at this time
              </div>
            )}
          </div>

          {/* Attendance Summary */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
              📊 Attendance Summary
            </h3>
            
            {/* Class Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                Select Class:
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="">All Classes</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            {students.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Student</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Class</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Attendance Rate</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter(student => !selectedClassId || student.class_id === selectedClassId)
                      .map(student => {
                      // Calculate individual student attendance rate using actual attendance data
                      const studentAttendance = attendanceData.filter(a => a.student_id === student.id);
                      const presentDays = studentAttendance.filter(a => a.present).length;
                      const totalDays = studentAttendance.length;
                      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
                      
                      // Debug logging for first few students
                      if (students.indexOf(student) < 3) {
                        console.log(`Student ${student.name}:`, {
                          studentId: student.id,
                          attendanceRecords: studentAttendance.length,
                          presentDays,
                          totalDays,
                          attendanceRate
                        });
                      }
                      
                      const status = attendanceRate >= 90 ? 'Excellent' : 
                                   attendanceRate >= 80 ? 'Good' : 
                                   attendanceRate >= 70 ? 'Fair' : 'Poor';
                      
                      return (
                        <tr key={student.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '500' }}>{student.name}</div>
                          </td>
                          <td style={{ padding: '12px', color: '#666' }}>
                            {classes.find(c => c.id === student.class_id)?.name || 'N/A'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '600', color: '#1976d2' }}>
                              {attendanceRate}%
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: status === 'Excellent' ? '#e8f5e9' : 
                                         status === 'Good' ? '#e3f2fd' : 
                                         status === 'Fair' ? '#fff3e0' : '#ffebee',
                              color: status === 'Excellent' ? '#2e7d32' : 
                                     status === 'Good' ? '#1976d2' : 
                                     status === 'Fair' ? '#ed6c02' : '#c62828'
                            }}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                {selectedClassId ? 'No students found in the selected class.' : 'No students found.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Recent Alerts */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
              🔔 Recent Alerts
            </h3>
            {recentAlerts.length > 0 ? (
              <div>
                {recentAlerts.map(alert => (
                  <div key={alert.id} style={{ 
                    padding: '12px', 
                    border: '1px solid #eee', 
                    borderRadius: '8px', 
                    marginBottom: '12px',
                    background: '#fff8e1'
                  }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                      {alert.student?.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      {alert.reason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {new Date(alert.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No recent alerts
              </div>
            )}
          </div>


        </div>
      </div>

      {/* Intervention Modal */}
      {showInterventionModal && selectedAlert && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 500, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 32px #0003', position: 'relative' }}>
            <button 
              onClick={() => {
                setShowInterventionModal(false);
                setSelectedAlert(null);
                setInterventionText('');
              }} 
              style={{ position: 'absolute', top: 16, right: 16, background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 18 }}
            >
              ×
            </button>
            
            <h2 style={{ marginBottom: 16, color: '#1a1a1a' }}>
              Record Intervention for {selectedAlert.student?.name}
            </h2>
            
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: '#666', marginBottom: 8 }}>
                <strong>Student:</strong> {selectedAlert.student?.name}
              </p>
              <p style={{ color: '#666', marginBottom: 8 }}>
                <strong>Class:</strong> {classes.find(c => c.id === selectedAlert.student?.class_id)?.name || 'N/A'}
              </p>
              <p style={{ color: '#666', marginBottom: 16 }}>
                <strong>Risk Reason:</strong> {selectedAlert.reason}
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#1a1a1a' }}>
                Intervention Details *
              </label>
              <textarea
                value={interventionText}
                onChange={(e) => setInterventionText(e.target.value)}
                placeholder="Describe the intervention action you are taking to address this dropout risk..."
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: 12,
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowInterventionModal(false);
                  setSelectedAlert(null);
                  setInterventionText('');
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: 14
                }}
                disabled={interventionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleInterventionSubmit}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#2e7d32',
                  color: '#fff',
                  cursor: interventionLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: interventionLoading ? 0.7 : 1
                }}
                disabled={interventionLoading}
              >
                {interventionLoading ? 'Saving...' : 'Save Intervention'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon, color, onClick }) {
  return (
    <div 
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'transform 0.2s, box-shadow 0.2s' : 'none'
      }}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px', marginRight: '12px' }}>{icon}</span>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#666', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: color }}>{value}</div>
    </div>
  );
}
