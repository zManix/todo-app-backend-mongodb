# MongoDB Task Management System

This repository contains a NoSQL database implementation for a task management system using MongoDB. The database consists of three collections: Tasks, Folders, and Tags, with relationships between them as defined in the entity-relationship diagram.

## Database Schema

### Tasks Collection
- **title**: String
- **description**: String
- **status**: String ["todo", "in-progress", "done"]
- **due_date**: Date
- **priority**: String ["low", "medium", "high"]
- **assigned_user**: String
- **created_at**: Date
- **updated_at**: Date
- **folders**: Array of ObjectIds (references to Folders)
- **tags**: Array of ObjectIds (references to Tags)

### Folders Collection
- **name**: String
- **created_at**: Date
- **updated_at**: Date
- **tasks**: Array of ObjectIds (references to Tasks)

### Tags Collection
- **name**: String
- **color**: String
- **created_at**: Date
- **tasks**: Array of ObjectIds (references to Tasks)

## Demo Queries

Below are the MongoDB queries used to demonstrate the implementation of each requirement.

### 2.4 Physical Data Model, Data Insertion

```javascript
// Insert a new task with all required attributes
db.tasks.insertOne({
  title: "Demo for class",
  description: "This task was created during the live demo",
  status: "todo",
  due_date: new Date("2025-04-15"),
  priority: "high",
  assigned_user: "teacher@school.edu",
  created_at: new Date(),
  updated_at: new Date(),
  folders: [db.folders.findOne()._id],
  tags: [db.tags.findOne()._id]
});
```

### 2.5 Modify and Delete Data for All Entity Types

```javascript
// Update a task
db.tasks.updateOne(
  { title: "Demo for class" },
  { $set: { status: "in-progress", priority: "medium", updated_at: new Date() } }
);

// Update a folder
db.folders.updateOne(
  { name: "Work Projects" },
  { $set: { name: "School Projects", updated_at: new Date() } }
);

// Update a tag
db.tags.updateOne(
  { name: "Urgent" },
  { $set: { color: "#FF0000" } }
);

// Delete a task
db.tasks.deleteOne({ title: "Demo for class" });
```

### 2.6 Display Data, Individual + Aggregation

```javascript
// Show a single task with all details
db.tasks.findOne({ title: "Complete quarterly report" });

// Simple list of high priority tasks
db.tasks.find({ priority: "high" }, { title: 1, status: 1, due_date: 1 });

// Aggregation: Count tasks by status
db.tasks.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);

// Aggregation: Find tasks with their folders and tags
db.tasks.aggregate([
  { $match: { priority: "high" } },
  { $limit: 3 },
  { $lookup: {
      from: "folders",
      localField: "folders",
      foreignField: "_id",
      as: "folderDetails"
    }
  },
  { $lookup: {
      from: "tags",
      localField: "tags",
      foreignField: "_id",
      as: "tagDetails"
    }
  },
  { $project: {
      _id: 0,
      title: 1,
      status: 1,
      "folderDetails.name": 1,
      "tagDetails.name": 1,
      "tagDetails.color": 1
    }
  }
]);
```

### 2.7 Sufficient Data Available (≥20 Objects per Type)

```javascript
// Count documents in each collection
db.tasks.countDocuments();
db.folders.countDocuments();
db.tags.countDocuments();

// List some sample data from each collection
db.tasks.find({}, {title: 1, status: 1, priority: 1}).limit(5);
db.folders.find({}, {name: 1}).limit(5);
db.tags.find({}, {name: 1, color: 1}).limit(5);
```

## Complete Task Relationships Query

This query demonstrates how to retrieve tasks with all their related folders and tags:

```javascript
db.tasks.aggregate([
  { $limit: 5 },
  { $lookup: {
      from: "folders",
      localField: "folders",
      foreignField: "_id",
      as: "folderDetails"
    }
  },
  { $lookup: {
      from: "tags",
      localField: "tags",
      foreignField: "_id",
      as: "tagDetails"
    }
  },
  { $project: {
      _id: 1,
      title: 1,
      description: 1,
      status: 1,
      due_date: 1,
      priority: 1,
      assigned_user: 1,
      created_at: 1,
      updated_at: 1,
      folders: { 
        $map: {
          input: "$folderDetails",
          as: "folder",
          in: {
            id: "$$folder._id",
            name: "$$folder.name"
          }
        }
      },
      tags: { 
        $map: {
          input: "$tagDetails",
          as: "tag",
          in: {
            id: "$$tag._id",
            name: "$$tag.name",
            color: "$$tag.color"
          }
        }
      }
    }
  },
  { $sort: { priority: -1, due_date: 1 } }
]);
```

## Setup Instructions

1. Start MongoDB
   ```
   mongod
   ```

2. Connect to MongoDB
   ```
   mongosh "mongodb://localhost:27017/task_manager"
   ```

3. Create the database and collections
   ```javascript
   use task_manager;

   db.createCollection("tasks");
   db.createCollection("folders");
   db.createCollection("tags");
   ```

4. Run the provided queries to populate the database and demonstrate the requirements.

## Entity Relationship Diagram

The database implementation is based on the following entity relationship diagram:

```
+----------------+       +----------------+       +----------------+
|     Tasks      |       |    Folders     |       |      Tags      |
+----------------+       +----------------+       +----------------+
| title          |       | name           |       | name           |
| description    |       | created_at     |       | color          |
| status         |<----->| updated_at     |       | created_at     |
| due_date       |       |                |       |                |
| priority       |       |                |       |                |
| assigned_user  |       |                |<----->|                |
| created_at     |       |                |       |                |
| updated_at     |       |                |       |                |
+----------------+       +----------------+       +----------------+
```

Where the relationships are:
- A Task can belong to multiple Folders
- A Folder can contain multiple Tasks
- A Task can have multiple Tags
- A Tag can be applied to multiple Tasks


## Replication
To replicate the database first create a mongo-keyfile:
```bash
openssl rand -base64 741 > mongo-keyfile
chmod 400 mongo-keyfile
chown 999:999 mongo-keyfile
```

Then start the docker-compose:
```
docker-compose up -d
```

## Backup and Restore

To backup the database, use the following command:
```bash
mongodump --host localhost --port 27017 --db m165 --username root --password root --authenticationDatabase admin --out ./backup/$(date +%Y-%m-%d)
```

To restore the database, use the following command:
```bash
mongorestore --host localhost --port 27017 --db m165_restore --username root --password root --authenticationDatabase admin ./backup/2025-03-26/m165
```