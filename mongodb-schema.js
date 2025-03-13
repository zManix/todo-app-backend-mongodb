// MongoDB Schema and Sample Data Creation
// Complete script with no placeholders

// 1. Drop existing collections if they exist
db.tasks.drop();
db.folders.drop();
db.tags.drop();

// 2. Create collections with validation
db.createCollection("tasks", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "status", "priority", "created_at", "updated_at"],
      properties: {
        title: {
          bsonType: "string",
          description: "Title of the task"
        },
        description: {
          bsonType: "string",
          description: "Description of the task"
        },
        status: {
          enum: ["todo", "in-progress", "done"],
          description: "Status must be one of the predefined values"
        },
        due_date: {
          bsonType: "date",
          description: "Due date for the task"
        },
        priority: {
          enum: ["low", "medium", "high"],
          description: "Priority must be one of the predefined values"
        },
        assigned_user: {
          bsonType: "string",
          description: "User assigned to the task"
        },
        created_at: {
          bsonType: "date",
          description: "Date when the task was created"
        },
        updated_at: {
          bsonType: "date",
          description: "Date when the task was last updated"
        },
        folders: {
          bsonType: "array",
          description: "List of folder IDs the task belongs to"
        },
        tags: {
          bsonType: "array",
          description: "List of tag IDs associated with the task"
        }
      }
    }
  }
});

db.createCollection("folders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "created_at", "updated_at"],
      properties: {
        name: {
          bsonType: "string",
          description: "Name of the folder"
        },
        created_at: {
          bsonType: "date",
          description: "Date when the folder was created"
        },
        updated_at: {
          bsonType: "date",
          description: "Date when the folder was last updated"
        },
        tasks: {
          bsonType: "array",
          description: "List of task IDs in this folder"
        }
      }
    }
  }
});

db.createCollection("tags", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "color", "created_at"],
      properties: {
        name: {
          bsonType: "string",
          description: "Name of the tag"
        },
        color: {
          bsonType: "string",
          description: "Color code for the tag"
        },
        created_at: {
          bsonType: "date",
          description: "Date when the tag was created"
        },
        tasks: {
          bsonType: "array",
          description: "List of task IDs associated with this tag"
        }
      }
    }
  }
});

// 3. Generate sample data

// Generate 20 tags
const tagNames = ["Work", "Personal", "Urgent", "Meeting", "Project", "Finance", 
                  "Health", "Education", "Family", "Home", "Shopping", "Travel", 
                  "Hobby", "Maintenance", "Follow-up", "Ideas", "Research", 
                  "Documentation", "Planning", "Social"];
                  
const colors = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33F3", "#33FFF3", 
                "#FF8C33", "#8C33FF", "#33FF8C", "#FF338C", "#8CFF33", "#338CFF", 
                "#FFCC33", "#33FFCC", "#CC33FF", "#CCFF33", "#33CCFF", "#FF33CC", 
                "#FF5733", "#33FF57"];

const tags = [];
for (let i = 0; i < 20; i++) {
  const tagId = new ObjectId();
  tags.push({
    _id: tagId,
    name: tagNames[i],
    color: colors[i],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
    tasks: []
  });
}

// Generate 20 folders
const folderNames = ["Work Projects", "Personal Tasks", "Home Improvement", "Study Materials",
                     "Financial Planning", "Health & Fitness", "Travel Plans", "Shopping Lists",
                     "Meeting Notes", "Project Alpha", "Project Beta", "Family Activities",
                     "Maintenance Tasks", "Ideas & Inspiration", "Research Topics", "Documentation",
                     "Future Plans", "Social Events", "Daily Routines", "Miscellaneous"];

const folders = [];
for (let i = 0; i < 20; i++) {
  const folderId = new ObjectId();
  folders.push({
    _id: folderId,
    name: folderNames[i],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
    updated_at: new Date(),
    tasks: []
  });
}

// Generate 20 tasks with relationships to folders and tags
const taskTitles = [
  "Complete quarterly report", "Prepare presentation slides", "Schedule team meeting",
  "Review project proposal", "Update client documentation", "Fix bug in login module",
  "Create new marketing materials", "Research competitor products", "Order office supplies",
  "Plan team building event", "Update personal website", "Go grocery shopping",
  "Schedule dentist appointment", "Pay monthly bills", "Clean garage",
  "Book flight tickets", "Prepare tax documents", "Organize digital files",
  "Call insurance company", "Write blog post"
];

const taskDescriptions = [
  "Compile all quarterly data and create summary report",
  "Create slides for the upcoming client presentation",
  "Set up a meeting with the development team to discuss new features",
  "Review the new project proposal and provide feedback",
  "Update the documentation for the latest release",
  "Fix the authentication issue in the login module",
  "Design new marketing materials for the spring campaign",
  "Research and analyze competitor products and features",
  "Order necessary supplies for the office",
  "Plan and organize the quarterly team building event",
  "Update personal portfolio website with recent projects",
  "Buy groceries for the week",
  "Schedule a routine check-up with the dentist",
  "Pay monthly utility and credit card bills",
  "Clean and organize the garage",
  "Book flights for the upcoming business trip",
  "Organize and prepare documents for tax filing",
  "Organize and categorize digital files and photos",
  "Call insurance company about policy renewal",
  "Write a blog post about recent industry trends"
];

const assignedUsers = [
  "john.doe@example.com", "jane.smith@example.com", "mike.johnson@example.com",
  "sarah.williams@example.com", "david.brown@example.com", "lisa.davis@example.com",
  "robert.miller@example.com", "jennifer.wilson@example.com", "michael.moore@example.com",
  "patricia.taylor@example.com", "james.anderson@example.com", "linda.thomas@example.com",
  "william.jackson@example.com", "elizabeth.white@example.com", "richard.harris@example.com",
  "barbara.martin@example.com", "charles.thompson@example.com", "susan.garcia@example.com",
  "joseph.martinez@example.com", "margaret.robinson@example.com"
];

const statuses = ["todo", "in-progress", "done"];
const priorities = ["low", "medium", "high"];

const tasks = [];
for (let i = 0; i < 20; i++) {
  const taskId = new ObjectId();
  
  // Assign random folders (1-3 folders per task)
  const numFolders = Math.floor(Math.random() * 3) + 1;
  const taskFolders = [];
  for (let j = 0; j < numFolders; j++) {
    const randomFolderIndex = Math.floor(Math.random() * 20);
    const randomFolderId = folders[randomFolderIndex]._id;
    
    if (!taskFolders.some(id => id.toString() === randomFolderId.toString())) {
      taskFolders.push(randomFolderId);
      folders[randomFolderIndex].tasks.push(taskId);
    }
  }
  
  // Assign random tags (1-5 tags per task)
  const numTags = Math.floor(Math.random() * 5) + 1;
  const taskTags = [];
  for (let j = 0; j < numTags; j++) {
    const randomTagIndex = Math.floor(Math.random() * 20);
    const randomTagId = tags[randomTagIndex]._id;
    
    if (!taskTags.some(id => id.toString() === randomTagId.toString())) {
      taskTags.push(randomTagId);
      tags[randomTagIndex].tasks.push(taskId);
    }
  }
  
  // Generate a random date in the past for created_at
  const createdAt = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
  
  // Generate a random date in the future for due_date (0-30 days from now)
  const dueDate = new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
  
  tasks.push({
    _id: taskId,
    title: taskTitles[i],
    description: taskDescriptions[i],
    status: statuses[Math.floor(Math.random() * 3)],
    due_date: dueDate,
    priority: priorities[Math.floor(Math.random() * 3)],
    assigned_user: assignedUsers[i],
    created_at: createdAt,
    updated_at: new Date(),
    folders: taskFolders,
    tags: taskTags
  });
}

// 4. Insert data into collections
db.tasks.insertMany(tasks);
db.folders.insertMany(folders);
db.tags.insertMany(tags);

// 5. Create indexes for better query performance
db.tasks.createIndex({ status: 1 });
db.tasks.createIndex({ priority: 1 });
db.tasks.createIndex({ due_date: 1 });
db.tasks.createIndex({ assigned_user: 1 });
db.folders.createIndex({ name: 1 });
db.tags.createIndex({ name: 1 });

// 6. Sample queries with no placeholders

// Store first folder ID and tag ID for use in queries
let firstFolderId = null;
let firstTagId = null;

const firstFolder = db.folders.findOne();
if (firstFolder) {
  firstFolderId = firstFolder._id;
  print("Using folder ID: " + firstFolderId);
}

const firstTag = db.tags.findOne();
if (firstTag) {
  firstTagId = firstTag._id;
  print("Using tag ID: " + firstTagId);
}

// Find all high priority tasks
print("\nHigh priority tasks:");
db.tasks.find({ priority: "high" }).forEach(task => {
  print(` - ${task.title} (${task.status})`);
});

// Find all tasks in a specific folder
if (firstFolderId) {
  print("\nTasks in folder '" + firstFolder.name + "':");
  db.tasks.find({ folders: firstFolderId }).forEach(task => {
    print(` - ${task.title}`);
  });
}

// Find all tasks with a specific tag
if (firstTagId) {
  print("\nTasks with tag '" + firstTag.name + "':");
  db.tasks.find({ tags: firstTagId }).forEach(task => {
    print(` - ${task.title}`);
  });
}

// Find all overdue tasks
print("\nOverdue tasks:");
db.tasks.find({ 
  due_date: { $lt: new Date() }, 
  status: { $ne: "done" } 
}).forEach(task => {
  print(` - ${task.title} (due: ${task.due_date.toDateString()})`);
});

// Find all tasks assigned to a specific user
const specificUser = "john.doe@example.com";
print("\nTasks assigned to " + specificUser + ":");
db.tasks.find({ assigned_user: specificUser }).forEach(task => {
  print(` - ${task.title}`);
});

// Find all tasks in a folder with their tags (using aggregation)
if (firstFolderId) {
  print("\nTasks in folder '" + firstFolder.name + "' with their tags:");
  db.tasks.aggregate([
    { $match: { folders: firstFolderId } },
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
        tagNames: { $map: {
          input: "$tagDetails",
          as: "tag",
          in: "$$tag.name"
        }}
      }
    }
  ]).forEach(result => {
    print(` - ${result.title} (Tags: ${result.tagNames.join(", ")})`);
  });
}

print("\nDatabase setup completed successfully!");
