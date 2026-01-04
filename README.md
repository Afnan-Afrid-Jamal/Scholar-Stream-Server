# ScholarStream

**ScholarStream** is a full-stack MERN (MongoDB, Express, React, Node.js) application designed to connect students with scholarship opportunities. It simplifies the process of finding financial aid for education and provides an organized platform for administrators to manage applications efficiently.

## Live URL : https://scholar-stream-project.netlify.app

## Purpose

The purpose of ScholarStream is to create a centralized platform where:

- Students can browse and apply for scholarships easily.
- Universities or organizations can post scholarship opportunities.
- Moderators can review applications, provide feedback, and update statuses.
- Admins can manage users, scholarships, and view analytics to make data-driven decisions.

## Key Features

### Student

- Browse all scholarships in a responsive grid.
- Search scholarships by name, university, or degree.
- Filter scholarships by category, subject, or location.
- Apply for scholarships and make secure payments via Stripe.
- View application status and feedback from moderators.
- Add and manage reviews for scholarships.
- Dashboard to manage personal profile, applications, and reviews.

### Moderator

- Manage submitted applications.
- Provide feedback and update application status (Processing/Completed/Rejected).
- Review and moderate student reviews.
- View detailed application information in modals.

### Admin

- Add, update, and delete scholarships.
- Manage users and change roles (Student, Moderator, Admin).
- View analytics with charts for total users, fees collected, and scholarship distribution.
- Dashboard with visual data representation.

### General Features

- Authentication system with email/password and social login (Google).
- Role-based dashboards with conditional sidebar links.
- Responsive and modern UI built with **DaisyUI** and **Tailwind CSS**.
- Loading spinners/skeletons for data-fetching pages.
- Custom 404 Error page.
- JWT token verification for secure API calls.
- Server-side search, filter, sort, and pagination.

## Data Collections

- **Users**: name, email, photoURL, role.
- **Scholarships**: scholarshipName, universityName, image, country, city, world rank, category, degree, fees, deadlines, postedUserEmail.
- **Applications**: scholarshipId, userId, userName, application fees, service charge, status, payment status, feedback.
- **Reviews**: scholarshipId, universityName, userName, rating, comment, reviewDate.

## Technologies / NPM Packages Used

- **Frontend**:

  - React
  - React Router
  - DaisyUI / Tailwind CSS
  - Framer Motion
  - Axios
  - React Icons
  - Stripe React SDK

- **Backend**:

  - Node.js
  - Express.js
  - MongoDB & Mongoose
  - Cors
  - Dotenv

- **Other Tools**:
  - Firebase Authentication
  - SweetAlert2 (for alerts and confirmations)

## Author

- **Afnan Afrid Jamal**

## How to Run Locally

Follow these steps to set up the project on your local machine:

### 1. Clone the Repository
```bash
git clone [https://github.com/Afnan-Afrid-Jamal/ScholarStream.git](https://github.com/Afnan-Afrid-Jamal/ScholarStream.git)
cd ScholarStream
