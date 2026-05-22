# Task Manager

A full-stack task manager with JWT authentication, role-based access control, and a dark-themed UI. Built with Node.js/Express on the backend and vanilla JS + Tailwind CSS on the frontend.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Auth](#auth-endpoints)
  - [Tasks](#task-endpoints)
  - [Admin](#admin-endpoints)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Role System](#role-system)
- [Frontend Overview](#frontend-overview)
- [Running API Tests](#running-api-tests)

---

## Features

- **User authentication** — register, login, logout with JWT
- **Token blacklisting** — logged-out tokens are immediately invalidated
- **Password management** — change password with current password verification
- **Task CRUD** — create, read, update, delete tasks per user
- **Due dates** — with color-coded badges (overdue, today, soon, normal)
- **Filtering & search** — filter by all/pending/completed, search by title
- **Pagination** — client-side pagination with 10 tasks per page
- **Optimistic UI updates** — toggle/delete reflect instantly, revert on failure
- **Admin panel** — view platform stats, manage users and roles
- **Rate limiting** — 10 auth requests per 15 minutes per IP
- **Request logging** — colored console logs with method, route, status, and duration

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Runtime   | Node.js                             |
| Framework | Express.js                          |
| Database  | SQLite via sql.js (file: tasks.db)  |
| Auth      | JSON Web Tokens (jsonwebtoken)      |
| Passwords | bcryptjs                            |
| Frontend  | Vanilla JS, Tailwind CSS (CDN), Inter font |

---

## Project Structure

```
TaskManagerTask5/
├── backend/
│   ├── controllers/
│   │   ├── authController.js     # register, login, logout, getMe, changePassword
│   │   ├── taskController.js     # getTasks, createTask, updateTask, deleteTask
│   │   └── adminController.js    # getAllUsers, updateUserRole, deleteUser, getStats
│   ├── middleware/
│   │   └── auth.js               # logger, rateLimit, authenticate, requireRole
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── tasks.js              # /api/tasks/*
│   │   └── admin.js              # /api/admin/*
│   ├── db.js                     # sql.js init, query, run, getOne helpers
│   ├── server.js                 # Express app entry point
│   ├── .env                      # Environment variables
│   └── package.json
├── frontend/
│   ├── index.html                # Single-page app shell
│   ├── auth.js                   # Login, register, logout, token management
│   ├── app.js                    # Task UI, admin panel, stats, pagination
│   └── style.css                 # Dark theme, animations, component styles
├── tasks.db                      # SQLite database file (auto-created)
├── test_apis.js                  # API test script
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd TaskManagerTask5

# Install backend dependencies
cd backend
npm install
```

### Running the Server

```bash
# From the backend directory
npm start

# Or with auto-kill of port 3000 before starting
npm run dev
```

The server starts at **http://localhost:3000**.

The frontend is served as static files from the `frontend/` directory — just open `http://localhost:3000` in your browser.

---

## Environment Variables

Located at `backend/.env`:

| Variable        | Default                                      | Description                        |
|-----------------|----------------------------------------------|------------------------------------|
| `PORT`          | `3000`                                       | Port the server listens on         |
| `JWT_SECRET`    | `super_secret_jwt_key_change_in_production_2024` | Secret used to sign JWTs       |
| `JWT_EXPIRES_IN`| `7d`                                         | JWT expiry duration                |
| `BCRYPT_ROUNDS` | `10`                                         | bcrypt hashing cost factor         |
| `NODE_ENV`      | `development`                                | Environment mode                   |
| `DEBUG`         | `true`                                       | Logs request bodies (passwords hidden) |

> **Important:** Change `JWT_SECRET` to a strong random value before deploying to production.

---

## API Reference

All API routes are prefixed with `/api`. Authenticated routes require the header:

```
Authorization: Bearer <token>
```

### Auth Endpoints

| Method | Route               | Auth | Description                        |
|--------|---------------------|------|------------------------------------|
| POST   | `/api/auth/register`| No   | Create a new user account          |
| POST   | `/api/auth/login`   | No   | Login and receive a JWT            |
| POST   | `/api/auth/logout`  | Yes  | Invalidate the current token       |
| GET    | `/api/auth/me`      | Yes  | Get the current user's profile     |
| PUT    | `/api/auth/password`| Yes  | Change the current user's password |

#### POST `/api/auth/register`

```json
// Request body
{
  "username": "johndoe",   // min 3 characters
  "email": "john@example.com",
  "password": "secret123"  // min 6 characters
}

// Response 201
{
  "token": "<jwt>",
  "user": { "id": 1, "username": "johndoe", "email": "john@example.com", "role": "user", "created_at": "..." }
}
```

#### POST `/api/auth/login`

```json
// Request body
{ "email": "john@example.com", "password": "secret123" }

// Response 200
{ "token": "<jwt>", "user": { ... } }
```

#### PUT `/api/auth/password`

```json
// Request body
{ "currentPassword": "secret123", "newPassword": "newSecret456" }

// Response 200
{ "message": "Password changed successfully" }
```

---

### Task Endpoints

All task routes require authentication. Users can only access their own tasks.

| Method | Route            | Description                              |
|--------|------------------|------------------------------------------|
| GET    | `/api/tasks`     | Get all tasks (supports filter, search, pagination) |
| POST   | `/api/tasks`     | Create a new task                        |
| PUT    | `/api/tasks/:id` | Update a task (title, completed, due_date) |
| DELETE | `/api/tasks/:id` | Delete a task                            |

#### GET `/api/tasks`

Query parameters:

| Param    | Values                    | Description                  |
|----------|---------------------------|------------------------------|
| `filter` | `all`, `completed`, `pending` | Filter by completion status |
| `search` | any string                | Filter by title (LIKE match) |
| `page`   | number (default: 1)       | Page number                  |
| `limit`  | number (default: 20)      | Results per page             |

```json
// Response 200
{
  "tasks": [ { "id": 1, "user_id": 1, "title": "Buy groceries", "completed": 0, "due_date": "2025-12-31", "created_at": "..." } ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

#### POST `/api/tasks`

```json
// Request body
{ "title": "Buy groceries", "due_date": "2025-12-31" }  // due_date is optional

// Response 201
{ "id": 1, "user_id": 1, "title": "Buy groceries", "completed": 0, "due_date": "2025-12-31", "created_at": "..." }
```

#### PUT `/api/tasks/:id`

```json
// Request body (all fields optional)
{ "title": "Buy groceries and cook", "completed": true, "due_date": "2025-12-31" }

// Response 200 — updated task object
```

---

### Admin Endpoints

All admin routes require authentication **and** the `admin` role.

| Method | Route                      | Description                          |
|--------|----------------------------|--------------------------------------|
| GET    | `/api/admin/stats`         | Platform-wide statistics             |
| GET    | `/api/admin/users`         | List all users with task counts      |
| PUT    | `/api/admin/users/:id/role`| Change a user's role (user/admin)    |
| DELETE | `/api/admin/users/:id`     | Delete a user and all their tasks    |

#### GET `/api/admin/stats`

```json
// Response 200
{
  "totalUsers": 10,
  "totalTasks": 42,
  "completedTasks": 18,
  "pendingTasks": 24,
  "recentUsers": [ { "id": 10, "username": "...", ... } ]
}
```

#### PUT `/api/admin/users/:id/role`

```json
// Request body
{ "role": "admin" }  // "user" or "admin"

// Response 200
{ "success": true, "message": "User 5 role updated to admin" }
```

> Admins cannot change their own role or delete their own account.

---

## Authentication

- On login or register, the server returns a signed JWT.
- The token is stored in `localStorage` under the key `tf_token`.
- Every authenticated request sends the token as `Authorization: Bearer <token>`.
- On logout, the token is added to an **in-memory blacklist** on the server — it is immediately rejected even if it hasn't expired.
- On page load, the frontend calls `GET /api/auth/me` to verify the stored token is still valid before showing the app.

> Note: The blacklist is in-memory and resets on server restart. This is acceptable for development scope.

---

## Rate Limiting

Auth routes (`/api/auth/register` and `/api/auth/login`) are rate-limited:

- **10 requests per 15 minutes per IP**
- Exceeding the limit returns `429 Too Many Requests`
- The counter resets automatically after the 15-minute window
- The rate limit map is in-memory and resets on server restart

---

## Role System

There are two roles:

| Role    | Permissions                                              |
|---------|----------------------------------------------------------|
| `user`  | Manage their own tasks, change their own password        |
| `admin` | Everything a user can do + access the admin panel        |

The first admin must be assigned directly in the database. After that, admins can promote/demote other users via the admin panel or the `PUT /api/admin/users/:id/role` endpoint.

---

## Frontend Overview

The frontend is a single-page application served from the `frontend/` directory.

### Pages

- **Auth page** — Sign In / Sign Up tabs with form validation, loading states, and error messages
- **App page** — Full task manager UI visible after login

### App UI Components

| Component       | Description                                                  |
|-----------------|--------------------------------------------------------------|
| Stats bar       | Shows total, completed, and pending task counts with animations |
| Progress bar    | Animated gradient bar showing completion percentage          |
| Add task form   | Title input (max 200 chars) + optional due date picker       |
| Search          | Debounced (250ms) client-side title search                   |
| Filter tabs     | All / Pending / Done — filters the in-memory task list       |
| Task list       | Paginated (10/page), with inline edit, toggle, and delete    |
| Due date badges | Color-coded: overdue (red), today (yellow), soon (orange), normal (grey) |
| Toast           | Bottom-center notifications for success, error, and info     |
| Admin panel     | Visible only to admins — shows stats grid and user management table |

### State Management

All tasks are fetched once on login and stored in a client-side `allTasks` array. Filtering, searching, and pagination all operate on this in-memory array without additional API calls. Mutations (add, update, delete) update the array directly and re-render.

---

## Running API Tests

A test script is included that covers all endpoints:

```bash
# Make sure the server is running first
cd backend && npm start

# In a separate terminal, from the project root
node test_apis.js
```

The script tests:
- Auth: register, duplicate register, validation, login, wrong password, get me, change password, logout, blacklisted token
- Tasks: create, validation, get with filters/search, update, delete, not-found cases
- Admin: 403 rejection for non-admin users
- Unknown routes: 404 handling

> The test uses timestamped usernames/emails on each run to avoid conflicts. Since auth routes are rate-limited to 10 requests per 15 minutes, restart the server between test runs to reset the in-memory rate limit counter.
