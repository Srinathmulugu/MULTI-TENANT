# Multi-Tenant SaaS Application

A full-stack starter for a multi-tenant SaaS app using React, Node.js, Express, and MongoDB.

## What is implemented

- One shared app used by multiple organizations
- Organization login using organization slug + email + password
- Separate tenant data using `organizationId` on all tenant resources
- Per-organization roles: `org_admin`, `manager`, and `member`
- Protected APIs with JWT auth and role checks
- Project workflow with statuses: `Pending`, `In Progress`, `Completed`
- Role-based actions:
	- `org_admin`: create/delete projects, manage members
	- `manager`: update project status
	- `member`: view-only access
- Project members system with assignment and removal
- Activity logs per project
- Project search, status filtering, sorting, pagination, and stats
- Project details page with members, status, description, and activity feed
- Admin APIs for managing users inside one organization

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Mongoose
- Database: MongoDB

## Project structure

- `server`: API and database layer
- `client`: React app

## Setup

1. Install root tooling

```bash
npm install
```

2. Install app dependencies

```bash
npm run install:all
```

3. Create environment file

Copy `server/.env.example` to `server/.env` and fill values.

4. Run both apps

```bash
npm run dev
```

- API: http://localhost:5000
- Client: http://localhost:5173

## Default flow

1. Register an organization from the login screen.
2. Login with the organization slug, email, and password.
3. Create and view organization-scoped projects.
4. Open admin page as `org_admin` and manage users in the same org.

## Notes

- Every tenant query is scoped using `req.user.organizationId` from JWT.
- Never trust tenant identifiers coming from the client body.
- This is a starter and can be extended with billing, invites, audit logs, and subscriptions.
- True multi-organization switching for a single user is not implemented yet. That requires a membership model where one user can belong to multiple organizations instead of the current single-organization user schema.
