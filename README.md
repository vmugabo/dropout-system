# Komeza Wige: School Attendance & Dropout Risk System

## Overview

Komeza Wige is a modern school management system focused on attendance tracking and early warning for student dropout risk. It empowers teachers and district officials to monitor attendance, flag at-risk students, and make data-driven interventions.

## Features

- **Role-based dashboards:**
  - Teachers: See their classes, students, attendance analytics, and at-risk students.
  - District Heads: District-wide stats, school/class drill-down, and at-risk student overviews.
- **Attendance tracking:** Record and analyze daily student attendance.
- **Dropout risk flagging:** Automatically flag students with 3+ consecutive absences.
- **Reports:**
  - Attendance summaries and trends
  - At-risk students with reasons and teacher contact
  - Export and print options
- **Modern UI:** Responsive, clean, and intuitive.

## Tech Stack

- **Frontend:** React (with hooks)
- **Backend/DB:** Supabase (PostgreSQL, Auth, Realtime)
- **Styling:** Inline styles (customizable)

## How to Access

1. **Go to the web portal:**
   - Open your browser and navigate to the Komeza Wige web portal (URL provided by your administrator).
2. **Log in:**
   - Enter your username (email) and password to access your account.
   - If you do not have an account, contact your system administrator for access.

## Database Schema Summary

- **district**: id, name
- **school**: id, name, district_id
- **profile**: id, name, email, role, school_id, district_id
- **class**: id, name, school_id, teacher_id
- **student**: id, name, gender, class_id, school_id, status, date_of_birth
- **attendance**: id, student_id, date, present
- **alert**: id, student_id, generated_at, reason, school_id, district_id

## Usage Guide

### Logging In

- Go to the Komeza Wige web portal in your browser.
- Enter your email and password, then click **Log In**.
- If you have trouble logging in, contact your system administrator.

---

### For Teachers

#### Dashboard & Reports Overview

- After logging in, you will see your personalized dashboard and reports page.
- At the top, you’ll see **Quick Stats Cards**:
  - **Total Classes:** Number of classes you teach.
  - **Total Students:** Number of students across your classes.
  - **Avg Attendance:** Overall attendance rate for your students.
  - **Students at Risk:** Number of students flagged as at risk of dropping out.

#### Attendance Rates by Class

- Below the stats, you’ll see a table listing each of your classes and their attendance percentage.
- **Click on a class name** to view detailed attendance and flagged students for that class.

#### Class Dropdown

- You can also use the class dropdown to select a class and view its details.
- The dropdown only shows classes you are assigned to teach.

#### Attendance Summary & Trend

- For the selected class, you’ll see:
  - **Attendance Summary Table:** Each student’s days present, days absent, and attendance percentage.
  - **Attendance Trend Chart:** Weekly attendance rates for the class.

#### Flagged Students (Dropout Risk)

- If any students in the class are flagged (3+ consecutive absences), they will appear in the **Flagged Students** section.
- You’ll see:
  - Student name
  - Reason for flagging
  - Days missed and specific dates
- Use this to follow up with students or guardians as needed.

#### Exporting and Printing

- Use the **Export CSV** button to download the attendance summary for the selected class.
- Use the **Print** button to print the summary and trend for your records or meetings.

#### Tips & Troubleshooting

- If you see “No students found for this class,” check that students are assigned to the class in the system.
- If attendance or flagged students are missing, ensure records have been entered for those students.
- For any issues, contact your school’s system administrator.

---

### For District Heads

#### District Reports Overview

- After logging in, you are taken directly to the district reports page (no dashboard).
- At the top, you’ll see **Quick Stats Cards**:
  - **Total Schools:** Number of schools in your district.
  - **Total Students:** Number of students across all schools.
  - **District Avg Attendance:** Overall attendance rate for the district.
  - **Students at Risk:** Number of flagged students in the district.

#### Attendance Rates by School

- Below the stats, you’ll see a table listing each school and its attendance percentage.
- Use this to quickly identify schools with high or low attendance.

#### School and Class Filters

- Use the **School** dropdown to select a school in your district.
- Use the **Class** dropdown to drill down to a specific class within the selected school.
- The page will update to show attendance summaries and trends for the selected class.

#### Attendance Summary & Trend

- For the selected class, you’ll see:
  - **Attendance Summary Table:** Each student’s days present, days absent, and attendance percentage.
  - **Attendance Trend Chart:** Weekly attendance rates for the class.

#### Students at Risk (Lightbox)

- Click the **Students at Risk** card to open a detailed lightbox.
- The lightbox shows all flagged students in the district, including:
  - Student name
  - Reason for flagging
  - Class and school
  - Responsible teacher’s email (for follow-up)

#### Exporting and Printing

- Use the **Export CSV** button to download the attendance summary for the selected class.
- Use the **Print** button to print the summary and trend for your records or meetings.
