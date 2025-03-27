const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// ==================== TASK ROUTES ====================

// Get all tasks (with filtering)
router.get('/tasks', async (req, res) => {
  try {
    const { status, priority, folder, tag } = req.query;
    let filter = {};
    
    // Apply filters if provided
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (folder) filter.folders = new ObjectId(folder);
    if (tag) filter.tags = new ObjectId(tag);
    
    const tasks = await req.db.collection('tasks').find(filter).toArray();
    
    // Add folder and tag details to each task
    const tasksWithDetails = await Promise.all(tasks.map(async (task) => {
      let folderDetails = [];
      let tagDetails = [];
      
      if (task.folders && task.folders.length > 0) {
        folderDetails = await req.db.collection('folders').find({
          _id: { $in: task.folders }
        }).toArray();
      }
      
      if (task.tags && task.tags.length > 0) {
        tagDetails = await req.db.collection('tags').find({
          _id: { $in: task.tags }
        }).toArray();
      }
      
      return {
        ...task,
        folderDetails: folderDetails.map(f => ({ id: f._id, name: f.name })),
        tagDetails: tagDetails.map(t => ({ id: t._id, name: t.name, color: t.color }))
      };
    }));
    
    res.json(tasksWithDetails);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching tasks' });
  }
});

// Get task by ID
router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = new ObjectId(req.params.id);
    const task = await req.db.collection('tasks').findOne({ _id: taskId });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Add folder and tag details
    let folderDetails = [];
    let tagDetails = [];
    
    if (task.folders && task.folders.length > 0) {
      folderDetails = await req.db.collection('folders').find({
        _id: { $in: task.folders }
      }).toArray();
    }
    
    if (task.tags && task.tags.length > 0) {
      tagDetails = await req.db.collection('tags').find({
        _id: { $in: task.tags }
      }).toArray();
    }
    
    const taskWithDetails = {
      ...task,
      folderDetails: folderDetails.map(f => ({ id: f._id, name: f.name })),
      tagDetails: tagDetails.map(t => ({ id: t._id, name: t.name, color: t.color }))
    };
    
    res.json(taskWithDetails);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching task' });
  }
});

// Create task
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, status, due_date, priority, folders, tags } = req.body;
    
    // Validate input
    if (!title || !status) {
      return res.status(400).json({ error: 'Title and status are required' });
    }
    
    // Convert string IDs to ObjectIds, but handle empty arrays and null values properly
    let folderIds = [];
    let tagIds = [];
    
    if (folders && Array.isArray(folders) && folders.length > 0) {
      folderIds = folders.map(id => {
        try {
          return new ObjectId(id);
        } catch (err) {
          console.error(`Invalid folder ID format: ${id}`);
          return null;
        }
      }).filter(id => id !== null);
    }
    
    if (tags && Array.isArray(tags) && tags.length > 0) {
      tagIds = tags.map(id => {
        try {
          return new ObjectId(id);
        } catch (err) {
          console.error(`Invalid tag ID format: ${id}`);
          return null;
        }
      }).filter(id => id !== null);
    }
    
    const task = {
      title,
      description: description || "",
      status,
      due_date: due_date ? new Date(due_date) : null,
      priority: priority || "medium",
      created_at: new Date(),
      updated_at: new Date(),
      folders: folderIds,
      tags: tagIds
    };
    
    const result = await req.db.collection('tasks').insertOne(task);
    
    // Update folder and tag references only if we have valid IDs
    if (folderIds.length > 0) {
      await req.db.collection('folders').updateMany(
        { _id: { $in: folderIds } },
        { $addToSet: { tasks: result.insertedId } } // Use addToSet to avoid duplicates
      );
    }
    
    if (tagIds.length > 0) {
      await req.db.collection('tags').updateMany(
        { _id: { $in: tagIds } },
        { $addToSet: { tasks: result.insertedId } } // Use addToSet to avoid duplicates
      );
    }
    
    // Return the created task with its ID
    const createdTask = {
      _id: result.insertedId,
      ...task
    };
    
    res.status(201).json(createdTask);
    
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Server error while creating task' });
  }
});

// Update task
router.put('/tasks/:id', async (req, res) => {
  try {
    const taskId = new ObjectId(req.params.id);
    const updates = { ...req.body };
    const task = await req.db.collection('tasks').findOne({ _id: taskId });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Handle folder updates
    if (updates.folders !== undefined) {
      const oldFolderIds = task.folders || [];
      // Convert string IDs to ObjectIds and filter out any invalid IDs
      const newFolderIds = Array.isArray(updates.folders) ? 
        updates.folders
          .filter(id => id) // Remove null/empty values
          .map(id => {
            try { return new ObjectId(id); } 
            catch (e) { return null; }
          })
          .filter(id => id !== null) : [];
      
      // Remove task from folders that are no longer associated
      const removedFolders = oldFolderIds.filter(oldId => 
        !newFolderIds.some(newId => newId.toString() === oldId.toString())
      );
      
      if (removedFolders.length > 0) {
        await req.db.collection('folders').updateMany(
          { _id: { $in: removedFolders } },
          { $pull: { tasks: taskId } }
        );
      }
      
      // Add task to newly associated folders
      const addedFolders = newFolderIds.filter(newId => 
        !oldFolderIds.some(oldId => oldId.toString() === newId.toString())
      );
      
      if (addedFolders.length > 0) {
        await req.db.collection('folders').updateMany(
          { _id: { $in: addedFolders } },
          { $addToSet: { tasks: taskId } }
        );
      }
      
      updates.folders = newFolderIds;
    }
    
    // Handle tag updates
    if (updates.tags !== undefined) {
      const oldTagIds = task.tags || [];
      // Convert string IDs to ObjectIds and filter out any invalid IDs
      const newTagIds = Array.isArray(updates.tags) ? 
        updates.tags
          .filter(id => id) // Remove null/empty values
          .map(id => {
            try { return new ObjectId(id); } 
            catch (e) { return null; }
          })
          .filter(id => id !== null) : [];
      
      // Remove task from tags that are no longer associated
      const removedTags = oldTagIds.filter(oldId => 
        !newTagIds.some(newId => newId.toString() === oldId.toString())
      );
      
      if (removedTags.length > 0) {
        await req.db.collection('tags').updateMany(
          { _id: { $in: removedTags } },
          { $pull: { tasks: taskId } }
        );
      }
      
      // Add task to newly associated tags
      const addedTags = newTagIds.filter(newId => 
        !oldTagIds.some(oldId => oldId.toString() === newId.toString())
      );
      
      if (addedTags.length > 0) {
        await req.db.collection('tags').updateMany(
          { _id: { $in: addedTags } },
          { $addToSet: { tasks: taskId } }
        );
      }
      
      updates.tags = newTagIds;
    }
    
    // Convert dates if necessary
    if (updates.due_date) {
      try {
        updates.due_date = new Date(updates.due_date);
      } catch (e) {
        updates.due_date = null;
      }
    }
    
    // Add updated timestamp
    updates.updated_at = new Date();
    
    // Remove any undefined or null fields
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });
    
    // Update the task
    await req.db.collection('tasks').updateOne(
      { _id: taskId },
      { $set: updates }
    );
    
    // Get the updated task to return
    const updatedTask = await req.db.collection('tasks').findOne({ _id: taskId });
    
    res.json(updatedTask);
    
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Server error while updating task', details: error.message });
  }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = new ObjectId(req.params.id);
    const task = await req.db.collection('tasks').findOne({ _id: taskId });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Remove task references from folders
    if (task.folders && task.folders.length > 0) {
      await req.db.collection('folders').updateMany(
        { _id: { $in: task.folders } },
        { $pull: { tasks: taskId } }
      );
    }
    
    // Remove task references from tags
    if (task.tags && task.tags.length > 0) {
      await req.db.collection('tags').updateMany(
        { _id: { $in: task.tags } },
        { $pull: { tasks: taskId } }
      );
    }
    
    await req.db.collection('tasks').deleteOne({ _id: taskId });
    
    res.json({ message: 'Task deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while deleting task' });
  }
});

// ==================== FOLDER ROUTES ====================

// Get all folders
router.get('/folders', async (req, res) => {
  try {
    const folders = await req.db.collection('folders').find().toArray();
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching folders' });
  }
});

// Get folder by ID
router.get('/folders/:id', async (req, res) => {
  try {
    const folderId = new ObjectId(req.params.id);
    const folder = await req.db.collection('folders').findOne({ _id: folderId });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    res.json(folder);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching folder' });
  }
});

// Create folder
router.post('/folders', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const folder = {
      name,
      created_at: new Date(),
      updated_at: new Date(),
      tasks: []
    };
    
    const result = await req.db.collection('folders').insertOne(folder);
    
    res.status(201).json({ _id: result.insertedId, ...folder });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while creating folder' });
  }
});

// Update folder
router.put('/folders/:id', async (req, res) => {
  try {
    const folderId = new ObjectId(req.params.id);
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const folder = await req.db.collection('folders').findOne({ _id: folderId });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    await req.db.collection('folders').updateOne(
      { _id: folderId },
      { 
        $set: { 
          name, 
          updated_at: new Date() 
        } 
      }
    );
    
    res.json({ _id: folderId, ...folder, name, updated_at: new Date() });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while updating folder' });
  }
});

// Delete folder
router.delete('/folders/:id', async (req, res) => {
  try {
    const folderId = new ObjectId(req.params.id);
    const folder = await req.db.collection('folders').findOne({ _id: folderId });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Update tasks to remove folder reference
    if (folder.tasks && folder.tasks.length > 0) {
      await req.db.collection('tasks').updateMany(
        { folders: folderId },
        { $pull: { folders: folderId } }
      );
    }
    
    await req.db.collection('folders').deleteOne({ _id: folderId });
    
    res.json({ message: 'Folder deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while deleting folder' });
  }
});

// ==================== TAG ROUTES ====================

// Get all tags
router.get('/tags', async (req, res) => {
  try {
    const tags = await req.db.collection('tags').find().toArray();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching tags' });
  }
});

// Get tag by ID
router.get('/tags/:id', async (req, res) => {
  try {
    const tagId = new ObjectId(req.params.id);
    const tag = await req.db.collection('tags').findOne({ _id: tagId });
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    res.json(tag);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching tag' });
  }
});

// Create tag
router.post('/tags', async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ error: 'Tag name and color are required' });
    }
    
    const tag = {
      name,
      color,
      created_at: new Date(),
      tasks: []
    };
    
    const result = await req.db.collection('tags').insertOne(tag);
    
    res.status(201).json({ _id: result.insertedId, ...tag });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while creating tag' });
  }
});

// Update tag
router.put('/tags/:id', async (req, res) => {
  try {
    const tagId = new ObjectId(req.params.id);
    const { name, color } = req.body;
    
    if (!name && !color) {
      return res.status(400).json({ error: 'Tag name or color is required' });
    }
    
    const tag = await req.db.collection('tags').findOne({ _id: tagId });
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    const updates = {};
    if (name) updates.name = name;
    if (color) updates.color = color;
    updates.updated_at = new Date();
    
    await req.db.collection('tags').updateOne(
      { _id: tagId },
      { $set: updates }
    );
    
    res.json({ _id: tagId, ...tag, ...updates });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while updating tag' });
  }
});

// Delete tag
router.delete('/tags/:id', async (req, res) => {
  try {
    const tagId = new ObjectId(req.params.id);
    const tag = await req.db.collection('tags').findOne({ _id: tagId });
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    // Update tasks to remove tag reference
    if (tag.tasks && tag.tasks.length > 0) {
      await req.db.collection('tasks').updateMany(
        { tags: tagId },
        { $pull: { tags: tagId } }
      );
    }
    
    await req.db.collection('tags').deleteOne({ _id: tagId });
    
    res.json({ message: 'Tag deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while deleting tag' });
  }
});

// ==================== TASK AGGREGATION ROUTES ====================

// Get tasks by status (aggregation)
router.get('/tasks-by-status', async (req, res) => {
  try {
    const result = await req.db.collection('tasks').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          tasks: { $push: { title: '$title', _id: '$_id' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while aggregating tasks by status' });
  }
});

// Get tasks by folder (aggregation)
router.get('/tasks-by-folder', async (req, res) => {
  try {
    const folders = await req.db.collection('folders').find().toArray();
    
    // Get all tasks
    const tasks = await req.db.collection('tasks').find().toArray();
    
    // Group tasks by folder
    const tasksByFolder = folders.map(folder => {
      const folderTasks = tasks.filter(task => 
        task.folders && task.folders.some(folderId => 
          folderId.toString() === folder._id.toString()
        )
      );
      
      return {
        _id: folder._id,
        folderName: folder.name,
        count: folderTasks.length,
        tasks: folderTasks.map(task => ({ _id: task._id, title: task.title }))
      };
    });
    
    res.json(tasksByFolder);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while aggregating tasks by folder' });
  }
});

// Get tasks by tag (aggregation)
router.get('/tasks-by-tag', async (req, res) => {
  try {
    const tags = await req.db.collection('tags').find().toArray();
    
    // Get all tasks
    const tasks = await req.db.collection('tasks').find().toArray();
    
    // Group tasks by tag
    const tasksByTag = tags.map(tag => {
      const tagTasks = tasks.filter(task => 
        task.tags && task.tags.some(tagId => 
          tagId.toString() === tag._id.toString()
        )
      );
      
      return {
        _id: tag._id,
        tagName: tag.name,
        tagColor: tag.color,
        count: tagTasks.length,
        tasks: tagTasks.map(task => ({ _id: task._id, title: task.title }))
      };
    });
    
    res.json(tasksByTag);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while aggregating tasks by tag' });
  }
});

// Get tasks statistics (aggregation)
router.get('/task-stats', async (req, res) => {
  try {
    const totalTasks = await req.db.collection('tasks').countDocuments();
    
    const statusStats = await req.db.collection('tasks').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Get count by priority (if priority field exists)
    const priorityStats = await req.db.collection('tasks').aggregate([
      {
        $match: { priority: { $exists: true } }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    res.json({
      totalTasks,
      byStatus: statusStats,
      byPriority: priorityStats
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while getting task statistics' });
  }
});

module.exports = router;