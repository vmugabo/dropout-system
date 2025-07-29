import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Auth/Login';
import Attendance from './pages/Attendance';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import { getUserProfile } from './utils/getUserProfile';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [school, setSchool] = useState(null);
  const [district, setDistrict] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      getUserProfile(session.user.id)
        .then(setProfile)
        .catch(err => setProfileError(err.message));
    } else {
      setProfile(null);
      setProfileError(null);
    }
  }, [session]);

  // Set default page based on user role
  useEffect(() => {
    if (profile) {
      if (profile.role === 'head') {
        setPage('reports');
      } else {
        setPage('dashboard');
      }
    }
  }, [profile]);


  // Fetch school, district, and classes for dropdown
  useEffect(() => {
    if (profile?.role === 'head' && profile?.district_id) {
      // For head, fetch district directly
      supabase
        .from('district')
        .select('id, name')
        .eq('id', profile.district_id)
        .single()
        .then(({ data }) => setDistrict(data));
      setSchool(null);
      setClasses([]);
    } else if (profile?.school_id) {
      // For teacher/other, fetch school, then district
      supabase
        .from('school')
        .select('id, name, district_id')
        .eq('id', profile.school_id)
        .single()
        .then(({ data }) => {
          setSchool(data);
          if (data?.district_id) {
            supabase
              .from('district')
              .select('id, name')
              .eq('id', data.district_id)
              .single()
              .then(({ data }) => setDistrict(data));
          }
        });
      if (profile.role === 'teacher') {
        supabase
          .from('class')
          .select('name')
          .eq('school_id', profile.school_id)
          .eq('teacher_id', profile.id)
          .then(({ data }) => setClasses((data || []).map(c => c.name)));
      } else {
        setClasses([]);
      }
    } else {
      setSchool(null);
      setDistrict(null);
      setClasses([]);
    }
  }, [profile?.role, profile?.district_id, profile?.school_id, profile?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setPage('dashboard');
  };

  if (!session) return <Login onLogin={() => supabase.auth.getSession().then(({ data: { session } }) => setSession(session))} />;
  if (profileError) return <div style={{ padding: '20px', textAlign: 'center' }}>Error loading profile: {profileError}</div>;
  if (!profile) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading profile...</div>;

  // Debug logging
  console.log('App rendered with:', { profile, page, session: !!session });

  try {
    // Navigation pane
    return (
      <div>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#1976d2', color: '#fff', padding: '12px 24px', marginBottom: 32, position: 'relative' }}>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>Komeza Wige</span>
          {profile.role !== 'head' && (
            <button onClick={() => setPage('dashboard')} style={{ marginLeft: 24, padding: '8px 16px', border: 'none', borderRadius: 4, background: page === 'dashboard' ? '#1565c0' : '#fff', color: page === 'dashboard' ? '#fff' : '#1976d2', fontWeight: 600, cursor: 'pointer' }}>Dashboard</button>
          )}
          {profile.role === 'teacher' && (
            <button onClick={() => setPage('attendance')} style={{ marginLeft: 8, padding: '8px 16px', border: 'none', borderRadius: 4, background: page === 'attendance' ? '#1565c0' : '#fff', color: page === 'attendance' ? '#fff' : '#1976d2', fontWeight: 600, cursor: 'pointer' }}>Attendance</button>
          )}
          <button onClick={() => setPage('reports')} style={{ marginLeft: 8, padding: '8px 16px', border: 'none', borderRadius: 4, background: page === 'reports' ? '#1565c0' : '#fff', color: page === 'reports' ? '#fff' : '#1976d2', fontWeight: 600, cursor: 'pointer' }}>Reports</button>
          {profile.role === 'head' && (
            <button onClick={() => setPage('profile')} style={{ marginLeft: 8, padding: '8px 16px', border: 'none', borderRadius: 4, background: page === 'profile' ? '#1565c0' : '#fff', color: page === 'profile' ? '#fff' : '#1976d2', fontWeight: 600, cursor: 'pointer' }}>Students</button>
          )}
          <div style={{ flex: 1 }} />
          <div ref={dropdownRef} style={{ position: 'relative', marginRight: 16 }}>
            <button
              onClick={() => setDropdownOpen((open) => !open)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 4,
                background: dropdownOpen ? '#1565c0' : '#fff',
                color: dropdownOpen ? '#fff' : '#1976d2',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: 120,
              }}
            >
              {profile.name} ({profile.role === 'head' ? 'District Official' : profile.role}) ▼
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '110%',
                background: '#fff',
                color: '#222',
                borderRadius: 8,
                boxShadow: '0 2px 8px #0002',
                minWidth: 260,
                zIndex: 10,
                padding: 16,
                fontSize: 15,
              }}>
                <div style={{ marginBottom: 10 }}><strong>Name:</strong> {profile.name}</div>
                <div style={{ marginBottom: 10 }}><strong>Email:</strong> {profile.email}</div>
                {profile.role === 'head' && (
                  <div style={{ marginBottom: 10 }}><strong>District:</strong> {district ? district.name : 'Loading...'}</div>
                )}
                {profile.role === 'teacher' && (
                  <>
                    <div style={{ marginBottom: 10 }}><strong>School:</strong> {school ? school.name : 'Loading...'}</div>
                    <div style={{ marginBottom: 10 }}><strong>District:</strong> {district ? district.name : 'Loading...'}</div>
                    <div style={{ marginBottom: 10 }}><strong>Classes Taught:</strong> {classes.length > 0 ? classes.join(', ') : 'None'}</div>
                  </>
                )}
                {profile.role !== 'head' && profile.role !== 'teacher' && (
                  <>
                    <div style={{ marginBottom: 10 }}><strong>School:</strong> {school ? school.name : 'Loading...'}</div>
                    <div style={{ marginBottom: 10 }}><strong>District:</strong> {district ? district.name : 'Loading...'}</div>
                  </>
                )}
              </div>
            )}
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#fff', color: '#1976d2', fontWeight: 600, cursor: 'pointer' }}>Logout</button>
        </nav>
        <div>
          {page === 'dashboard' && profile.role !== 'head' && <Dashboard profile={profile} />}
          {page === 'attendance' && profile.role === 'teacher' && <Attendance profile={profile} onAttendanceSubmitted={() => setPage('dashboard')} />}
          {page === 'reports' && <Reports profile={profile} />}
          {page === 'profile' && profile.role === 'head' && <Profile profile={profile} />}
        </div>
      </div>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>Error: {error.message}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: '10px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Reload Page
        </button>
      </div>
    );
  }
}

export default App;
