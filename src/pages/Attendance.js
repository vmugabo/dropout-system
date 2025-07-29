import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Attendance({ profile, onAttendanceSubmitted }) {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('record'); // 'record' or 'view'
  const [retrievedAttendance, setRetrievedAttendance] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (profile.school_id) {
      supabase
        .from('class')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .then(({ data }) => setClasses(data || []));
    }
  }, [profile.school_id]);

  useEffect(() => {
    if (selectedClassId) {
      supabase
        .from('student')
        .select('*')
        .eq('class_id', selectedClassId)
        .then(({ data }) => setStudents(data || []));
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const filteredStudents = selectedClassId
    ? students.filter(s => s.class_id === selectedClassId)
    : [];

  const handleAttendanceChange = (studentId, present) => {
    setAttendance(prev => ({ ...prev, [studentId]: present }));
  };

  const handleRetrieveAttendance = async () => {
    if (!selectedClassId || !date) {
      setMessage('Please select both a class and date');
      return;
    }

    setViewLoading(true);
    setMessage('');

    try {
      // Get students in the selected class
      const { data: classStudents, error: studentsError } = await supabase
        .from('student')
        .select('id, name')
        .eq('class_id', selectedClassId);

      if (studentsError) {
        setMessage('Error fetching students');
        setViewLoading(false);
        return;
      }

      // Get attendance records for the selected date and class
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('date', date)
        .in('student_id', classStudents.map(s => s.id));

      if (attendanceError) {
        setMessage('Error fetching attendance');
        setViewLoading(false);
        return;
      }

      // Combine student data with attendance data
      const combinedData = classStudents.map(student => {
        const attendanceRecord = attendanceData.find(a => a.student_id === student.id);
        return {
          ...student,
          present: attendanceRecord ? attendanceRecord.present : null
        };
      });

      setRetrievedAttendance(combinedData);
      setMessage(`Retrieved attendance for ${date}`);
    } catch (error) {
      setMessage('Error retrieving attendance');
    }

    setViewLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const records = filteredStudents.map(student => ({
      student_id: student.id,
      date: date,
      present: attendance[student.id] ?? false,
    }));
    const { error } = await supabase.from('attendance').insert(records);
    if (error) {
      setMessage('Error saving attendance');
      setLoading(false);
      return;
    }
    // Flag at-risk students directly in the frontend
    for (const student of filteredStudents) {
      const { data: att, error: attError } = await supabase
        .from('attendance')
        .select('date, present')
        .eq('student_id', student.id)
        .order('date', { ascending: true });
      if (attError) continue;
      if (!att || att.length < 3) continue;
      let consecutive = 0;
      for (let i = 0; i < att.length; i++) {
        if (!att[i].present) {
          consecutive++;
          if (consecutive === 3) {
            const { data: existing, error: existingError } = await supabase
              .from('alert')
              .select('id')
              .eq('student_id', student.id)
              .maybeSingle();
            if (existingError) break;
            if (!existing) {
              await supabase.from('alert').insert({
                student_id: student.id,
                reason: 'Missed 3 consecutive days',
                school_id: student.school_id,
                district_id: profile.district_id,
              });
            }
            break;
          }
        } else {
          consecutive = 0;
        }
      }
    }
    setMessage('Attendance recorded!');
    setLoading(false);
    if (typeof onAttendanceSubmitted === 'function') {
      setTimeout(() => {
        onAttendanceSubmitted();
      }, 1000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', fontSize: 24, fontWeight: 600 }}>
        Recording attendance, please wait...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: 'auto', marginTop: 40, padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
      <h2 style={{ marginBottom: 24 }}>Attendance for {profile.name}</h2>
      
      {/* Mode Toggle */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setMode('record')}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: 'none',
            background: mode === 'record' ? '#1976d2' : '#f5f5f5',
            color: mode === 'record' ? '#fff' : '#333',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Record Attendance
        </button>
        <button
          type="button"
          onClick={() => setMode('view')}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: 'none',
            background: mode === 'view' ? '#1976d2' : '#f5f5f5',
            color: mode === 'view' ? '#fff' : '#333',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          View Attendance
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <label htmlFor="attendance-date">Date:&nbsp;</label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
            style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label htmlFor="class-select">Class:&nbsp;</label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            required
            style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="" disabled>Select class</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'record' && selectedClassId && (
        <>
          <button
            type="button"
            onClick={() => {
              const allPresent = {};
              filteredStudents.forEach(student => {
                allPresent[student.id] = true;
              });
              setAttendance(prev => ({ ...prev, ...allPresent }));
            }}
            style={{ marginBottom: 12, padding: '8px 20px', borderRadius: 4, border: 'none', background: '#2e7d32', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Select All Present
          </button>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Student</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Class</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Present</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Absent</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>{student.name}</td>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>
                    {(() => {
                      const cls = classes.find(c => c.id === student.class_id);
                      return cls ? cls.name : '';
                    })()}
                  </td>
                  <td style={{ textAlign: 'center', border: '1px solid #eee' }}>
                    <input
                      type="radio"
                      name={student.id}
                      checked={attendance[student.id] === true}
                      onChange={() => handleAttendanceChange(student.id, true)}
                    />
                  </td>
                  <td style={{ textAlign: 'center', border: '1px solid #eee' }}>
                    <input
                      type="radio"
                      name={student.id}
                      checked={attendance[student.id] === false}
                      onChange={() => handleAttendanceChange(student.id, false)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="submit"
            onClick={handleSubmit}
            style={{
              marginTop: 16,
              padding: '10px 24px',
              borderRadius: 4,
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            disabled={!selectedClassId}
            onMouseOver={e => e.currentTarget.style.background = '#1565c0'}
            onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
          >
            Submit Attendance
          </button>
        </>
      )}

      {mode === 'view' && selectedClassId && (
        <>
          <button
            type="button"
            onClick={handleRetrieveAttendance}
            disabled={viewLoading}
            style={{
              marginBottom: 16,
              padding: '10px 24px',
              borderRadius: 4,
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#1565c0'}
            onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
          >
            {viewLoading ? 'Loading...' : 'Retrieve Attendance'}
          </button>

          {retrievedAttendance.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 16 }}>Attendance for {date}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Student</th>
                    <th style={{ padding: 8, border: '1px solid #eee' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {retrievedAttendance.map(student => (
                    <tr key={student.id}>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{student.name}</td>
                      <td style={{ 
                        padding: 8, 
                        border: '1px solid #eee',
                        color: student.present === null ? '#666' : (student.present ? '#2e7d32' : '#c62828'),
                        fontWeight: 600
                      }}>
                        {student.present === null ? 'Not Recorded' : (student.present ? 'Present' : 'Absent')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {message && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 4, background: message.includes('Error') ? '#ffebee' : '#e8f5e9', color: message.includes('Error') ? '#c62828' : '#2e7d32' }}>
          {message}
        </div>
      )}
    </div>
  );
}
