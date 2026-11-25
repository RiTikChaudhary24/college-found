# CampusFind – Campus Lost & Found Portal

A full-stack MERN application for reporting lost/found items, searching listings, submitting claims, and moderating reports as an administrator.

## Features
- JWT registration/login with `student` and `admin` roles
- Create, browse, search and filter lost/found reports
- Item detail page with contact details
- Submit a claim for a found item
- Owner can review claims and mark an item as returned
- Admin can remove inappropriate listings
- MongoDB persistence and responsive React UI

## Requirements
- Node.js 18+
- MongoDB local instance or MongoDB Atlas connection string

## Setup

### 1. Backend
```bash
cd backend
cp .env.example .env
# Set MONGO_URI and JWT_SECRET in .env
npm install
npm run dev
```
Backend runs at http://localhost:5000

### 2. Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:5173

Create an admin account by registering normally, then set that user's `role` to `admin` in MongoDB Compass. This prevents public users from self-assigning admin privileges.

## Demo flow
1. Register two student accounts in separate browser sessions.
2. Account A creates a `Found` listing.
3. Account B opens that listing and submits a claim with identifying details.
4. Account A opens My Items and approves/rejects the claim.
5. Account A marks the item as returned.
6. Admin can delete unsuitable listings.

## Important
This is an academic demonstration project. Use test contact details, do not publish private student information, and do not treat the app as a production identity-verification system.

## Making an admin (v2)
After registering normally, run from the `backend` folder:
```bash
npm run make-admin -- your@email.com
```
Log out and in again (or just refresh). An **Admin** link appears in the navbar with stats, all listings and delete controls. Admins can also delete/reopen/mark-returned and review claims on any listing's detail page.

## Notes
- Contact details and claim messages are no longer public: contact needs login, claims are visible to the owner/admin only.
- If you used the old `package-lock.json` files, delete them and `node_modules`, then run `npm install` again (dependency versions are pinned now).
