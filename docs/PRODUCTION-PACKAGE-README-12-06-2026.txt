AVYONA PRODUCTION READY - 12-06-2026 (V.03)

Package contents
1. 00-HOSTINGER-BACKEND-UPLOAD-ROOT-FILES-CODE-ONLY
   Recommended backend update package for the existing Hostinger Node.js app.
   Upload the contents directly into the existing backend application root.
   This excludes uploads, node_modules, and local environment files.

2. 01-frontend-upload-to-public_html
   Upload these files to the website public_html directory.

3. 02-dashboard-upload-to-public_html-dashboard
   Upload these files to the public_html/dashboard directory.

4. 03-backend-node-app-upload
   Full backend application package, including a copy of the uploads folder.
   Configure the production .env before starting the application.

5. 04-backend-uploads
   Existing uploaded website and product media.

6. 05-database
   Current local MySQL database export and the Activity History migration.

7. 06-editable-source-code
   Full editable frontend, dashboard, backend, shared files, and project scripts.
   Run npm install after extracting because node_modules is intentionally excluded.

Local development URLs
- Storefront: http://localhost:5173
- Dashboard: http://localhost:5174
- Backend API: http://localhost:4000/api/v1

Activity History
- Dashboard path: /dashboard/settings/activity-history
- Visible only to Admin and Super Admin.

Important
- Back up the live Hostinger files and database before deployment.
- Do not overwrite the production .env with local credentials.
- Apply the database export only when a full database replacement is intended.
- For an existing production database, run the included Activity History migration.
