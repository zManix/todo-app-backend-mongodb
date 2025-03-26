// MongoDB User Creation Script for Task Management System
// Usage: mongosh -u <admin_username> -p <admin_password> --authenticationDatabase admin create-users.js

// Define the database name
const dbName = "m165";

use(dbName);

// Switch to the appropriate database
db = db.getSiblingDB(dbName);

// Create custom role for editor users
db.createRole({
  role: "editorRole",
  privileges: [
    {
      resource: { db: dbName, collection: "tasks" },
      actions: ["find", "insert", "update"],
    },
    {
      resource: { db: dbName, collection: "folders" },
      actions: ["find", "insert", "update"],
    },
    {
      resource: { db: dbName, collection: "tags" },
      actions: ["find", "insert", "update"],
    },
  ],
  roles: [],
});

// Create custom role for employee users
db.createRole({
  role: "employeeRole",
  privileges: [
    {
      resource: { db: dbName, collection: "tasks" },
      actions: ["find"],
    },
    {
      resource: { db: dbName, collection: "tasks" },
      actions: ["update"],
      // Only allow updates on documents where the user is assigned
      // Note: In a real application, you would implement this with $and and include the user's ID
      restriction: { assignedTo: { $exists: true } },
    },
    {
      resource: { db: dbName, collection: "folders" },
      actions: ["find"],
    },
    {
      resource: { db: dbName, collection: "tags" },
      actions: ["find"],
    },
  ],
  roles: [],
});

// 1. Admin User - Full database administration rights
db.createUser({
  user: "admin_user",
  pwd: "admin_password", // Change to a secure password in production
  roles: [
    { role: "dbAdmin", db: dbName },
    { role: "userAdmin", db: dbName },
    { role: "editorRole", db: dbName },
  ],
});

// 2. Manager User - Full data access but no admin rights
db.createUser({
  user: "manager_user",
  pwd: "manager_password", // Change to a secure password in production
  roles: [{ role: "readWrite", db: dbName }],
});

// 3. Editor User - Can create and modify but not delete
db.createUser({
  user: "editor_user",
  pwd: "editor_password", // Change to a secure password in production
  roles: [{ role: "editorRole", db: dbName }],
});

// 4. Employee User - Can only update assigned tasks
db.createUser({
  user: "employee_user",
  pwd: "employee_password", // Change to a secure password in production
  roles: [{ role: "employeeRole", db: dbName }],
});

// 5. Guest User - Read-only access
db.createUser({
  user: "guest_user",
  pwd: "guest_password", // Change to a secure password in production
  roles: [{ role: "read", db: dbName }],
});

print("All users created successfully for the " + dbName + " database.");
print("Created users:");
print("- admin_user");
print("- manager_user");
print("- editor_user");
print("- employee_user");
print("- guest_user");
