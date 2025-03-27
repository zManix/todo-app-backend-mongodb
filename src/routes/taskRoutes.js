const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = 'your_jwt_secret'; // Use environment variable in production

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await req.db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    if (!user) throw new Error();
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Authorization middleware
const authorize = (resourceType, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const roles = await req.db.collection('roles').find({ 
        _id: { $in: user.roles.map(id => new ObjectId(id)) }
      }).toArray();
      
      const hasPermission = roles.some(role => 
        role.permissions[resourceType] && 
        role.permissions[resourceType][action] === true
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Not authorized to perform this action' });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Server error during authorization check' });
    }
  };
};

// ==================== USER ROUTES ====================

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await req.db.collection('users').findOne({ username });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }
    
    // In a real app, use bcrypt.compare(password, user.password_hash)
    const isMatch = password === user.password_hash.replace('$2a$10$XYZ...', '');
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }
    
    // Update last login time
    await req.db.collection('users').updateOne(
      { _id: user._id },
      { $set: { last_login: new Date() }}
    );
    
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { username: user.username, email: user.email } });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get users (Admin only)
router.get('/users', authenticate, authorize('users', 'read'), async (req, res) => {
  try {
    const users = await req.db.collection('users').find({}, {
      projection: { password_hash: 0 }
    }).toArray();
    
    // Add role info to each user
    const usersWithRoles = await Promise.all(users.map(async (user) => {
      const roles = await req.db.collection('roles').find({ 
        _id: { $in: user.roles.map(id => new ObjectId(id)) }
      }).toArray();
      
      return {
        ...user,
        roleNames: roles.map(r => r.name)
      };
    }));
    
    res.json(usersWithRoles);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching users' });
  }
});

// Create user (Admin only)
router.post('/users', authenticate, authorize('users', 'create'), async (req, res) => {
  try {
    const { username, email, password, roleNames } = req.body;
    
    // Check if user already exists
    const existingUser = await req.db.collection('users').findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Find role IDs
    const roles = await req.db.collection('roles').find({ name: { $in: roleNames } }).toArray();
    if (roles.length !== roleNames.length) {
      return res.status(400).json({ error: 'One or more roles not found' });
    }
    
    // Hash password (use in production)
    // const passwordHash = await bcrypt.hash(password, 10);
    const passwordHash = `$2a$10$XYZ...${password}`;
    
    const newUser = {
      username,
      email,
      password_hash: passwordHash,
      roles: roles.map(r => r._id),
      created_at: new Date()
    };
    
    const result = await req.db.collection('users').insertOne(newUser);
    
    res.status(201).json({
      _id: result.insertedId,
      username,
      email,
      roles: roleNames
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while creating user' });
  }
});

// Get user by ID
router.get('/users/:id', authenticate, async (req, res) => {
  try {
    // Check if user has permission
    const isAdmin = await authorize('users', 'read')(req, res, () => true);
    if (!isAdmin && req.userId.toString() !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized to view this user' });
    }
    
    const user = await req.db.collection('users').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password_hash: 0 }}
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const roles = await req.db.collection('roles').find({ 
      _id: { $in: user.roles.map(id => new ObjectId(id)) }
    }).toArray();
    
    res.json({
      ...user,
      roleNames: roles.map(r => r.name)
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching user' });
  }
});

// ==================== TASK ROUTES ====================

// Get all tasks (with filtering)
router.get('/tasks', authenticate, authorize('tasks', 'read'), async (req, res) => {
  try {
    const { status, priority, folder, tag, assigned_to } = req.query;
    let filter = {};
    
    // Apply filters if provided
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (folder) filter.folders = new ObjectId(folder);
    if (tag) filter.tags = new ObjectId(tag);
    if (assigned_to) filter.assigned_user = assigned_to;
    
    // Check if user is admin/manager or regular user
    const user = req.user;
    const roles = await req.db.collection('roles').find({ 
      _id: { $in: user.roles.map(id => new ObjectId(id)) }
    }).toArray();
    
    const isAdminOrManager = roles.some(role => 
      ["Admin", "Manager"].includes(role.name)
    );
    
    // Regular users can only see assigned tasks
    if (!isAdminOrManager) {
      filter = {
        $and: [
          filter,
          {
            $or: [
              { assigned_user: user.email },
              { owner: user._id }
            ]
          }
        ]
      };
    }
    
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

// Create task
router.post('/tasks', authenticate, authorize('tasks', 'create'), async (req, res) => {
  try {
    const { title, description, status, due_date, priority, assigned_user, folders, tags } = req.body;
    
    // Validate input
    if (!title || !status || !priority) {
      return res.status(400).json({ error: 'Title, status and priority are required' });
    }
    
    // Convert string IDs to ObjectIds
    let folderIds = [];
    let tagIds = [];
    
    if (folders && folders.length > 0) {
      folderIds = folders.map(id => new ObjectId(id));
    }
    
    if (tags && tags.length > 0) {
      tagIds = tags.map(id => new ObjectId(id));
    }
    
    const task = {
      title,
      description,
      status,
      due_date: due_date ? new Date(due_date) : null,
      priority,
      assigned_user,
      created_at: new Date(),
      updated_at: new Date(),
      folders: folderIds,
      tags: tagIds,
      owner: req.userId
    };
    
    const result = await req.db.collection('tasks').insertOne(task);
    
    // Update folder and tag references
    if (folderIds.length > 0) {
      await req.db.collection('folders').updateMany(
        { _id: { $in: folderIds } },
        { $push: { tasks: result.insertedId } }
      );
    }
    
    if (tagIds.length > 0) {
      await req.db.collection('tags').updateMany(
        { _id: { $in: tagIds } },
        { $push: { tasks: result.insertedId } }
      );
    }
    
    res.status(201).json({ _id: result.insertedId, ...task });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while creating task' });
  }
});

// Update task
router.put('/tasks/:id', authenticate, authorize('tasks', 'update'), async (req, res) => {
  try {
    const taskId = new ObjectId(req.params.id);
    const updates = req.body;
    const task = await req.db.collection('tasks').findOne({ _id: taskId });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user can update this specific task
    const user = req.user;
    const roles = await req.db.collection('roles').find({ 
      _id: { $in: user.roles.map(id => new ObjectId(id)) }
    }).toArray();
    
    const isAdminOrManager = roles.some(role => 
      ["Admin", "Manager"].includes(role.name)
    );
    
    if (!isAdminOrManager && 
        task.assigned_user !== user.email && 
        (!task.owner || !task.owner.equals(user._id))) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }
    
    // Handle folder and tag updates
    if (updates.folders) {
      const oldFolderIds = task.folders || [];
      const newFolderIds = updates.folders.map(id => new ObjectId(id));
      
      // Remove task from folders that are no longer associated
      const removedFolders = oldFolderIds.filter(id => 
        !newFolderIds.some(newId => newId.equals(id))
      );
      
      if (removedFolders.length > 0) {
        await req.db.collection('folders').updateMany(
          { _id: { $in: removedFolders } },
          { $pull: { tasks: taskId } }
        );
      }
      
      // Add task to newly associated folders
      const addedFolders = newFolderIds.filter(id => 
        !oldFolderIds.some(oldId => oldId.equals(id))
      );
      
      if (addedFolders.length > 0) {
        await req.db.collection('folders').updateMany(
          { _id: { $in: addedFolders } },
          { $push: { tasks: taskId } }
        );
      }
      
      updates.folders = newFolderIds;
    }
    
    if (updates.tags) {
      const oldTagIds = task.tags || [];
      const newTagIds = updates.tags.map(id => new ObjectId(id));
      
      // Remove task from tags that are no longer associated
      const removedTags = oldTagIds.filter(id => 
        !newTagIds.some(newId => newId.equals(id))
      );
      
      if (removedTags.length > 0) {
        await req.db.collection('tags').updateMany(
          { _id: { $in: removedTags } },
          { $pull: { tasks: taskId } }
        );
      }
      
      // Add task to newly associated tags
      const addedTags = newTagIds.filter(id => 
        !oldTagIds.some(oldId => oldId.equals(id))
      );
      
      if (addedTags.length > 0) {
        await req.db.collection('tags').updateMany(
          { _id: { $in: addedTags } },
          { $push: { tasks: taskId } }
        );
      }
      
      updates.tags = newTagIds;
    }
    
    // Convert dates if necessary
    if (updates.due_date) {
      updates.due_date = new Date(updates.due_date);
    }
    
    // Add updated timestamp
    updates.updated_at = new Date();
    
    await req.db.collection('tasks').updateOne(
      { _id: taskId },
      { $set: updates }
    );
    
    res.json({ _id: taskId, ...task, ...updates });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while updating task' });
  }
});

// Delete task
router.delete('/tasks/:id', authenticate, authorize('tasks', 'delete'), async (req, res) => {
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
router.get('/folders', authenticate, authorize('folders', 'read'), async (req, res) => {
  try {
    const folders = await req.db.collection('folders').find().toArray();
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching folders' });
  }
});

// Create folder
router.post('/folders', authenticate, authorize('folders', 'create'), async (req, res) => {
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
router.put('/folders/:id', authenticate, authorize('folders', 'update'), async (req, res) => {
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
router.delete('/folders/:id', authenticate, authorize('folders', 'delete'), async (req, res) => {
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
router.get('/tags', authenticate, authorize('tags', 'read'), async (req, res) => {
  try {
    const tags = await req.db.collection('tags').find().toArray();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching tags' });
  }
});

// Create tag
router.post('/tags', authenticate, authorize('tags', 'create'), async (req, res) => {
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
router.put('/tags/:id', authenticate, authorize('tags', 'update'), async (req, res) => {
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
router.delete('/tags/:id', authenticate, authorize('tags', 'delete'), async (req, res) => {
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

// ==================== BACKUP ROUTES ====================

// Create backup
router.post('/backups', authenticate, authorize('users', 'create'), async (req, res) => {
  try {
    const { name } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = name || `backup_${timestamp}`;
    
    // Create backup collection if not exists
    if (!await req.db.listCollections({ name: 'backups' }).hasNext()) {
      await req.db.createCollection('backups');
    }
    
    // Gather all data for backup
    const tasks = await req.db.collection('tasks').find().toArray();
    const folders = await req.db.collection('folders').find().toArray();
    const tags = await req.db.collection('tags').find().toArray();
    const users = await req.db.collection('users').find().toArray();
    const roles = await req.db.collection('roles').find().toArray();
    
    const backup = {
      metadata: {
        name: backupName,
        createdAt: new Date(),
        createdBy: req.userId,
        version: "1.0"
      },
      tasks,
      folders,
      tags,
      users,
      roles
    };
    
    const result = await req.db.collection('backups').insertOne(backup);
    
    res.status(201).json({
      _id: result.insertedId,
      name: backupName,
      createdAt: backup.metadata.createdAt,
      counts: {
        tasks: tasks.length,
        folders: folders.length,
        tags: tags.length,
        users: users.length,
        roles: roles.length
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while creating backup' });
  }
});

// List backups
router.get('/backups', authenticate, authorize('users', 'read'), async (req, res) => {
  try {
    const backups = await req.db.collection('backups').find().project({
      'metadata': 1,
      'tasksCount': { $size: '$tasks' },
      'foldersCount': { $size: '$folders' },
      'tagsCount': { $size: '$tags' },
      'usersCount': { $size: '$users' },
      'rolesCount': { $size: '$roles' }
    }).toArray();
    
    res.json(backups);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching backups' });
  }
});

// Restore from backup
router.post('/backups/:id/restore', authenticate, authorize('users', 'create'), async (req, res) => {
  try {
    const backupId = new ObjectId(req.params.id);
    const backup = await req.db.collection('backups').findOne({ _id: backupId });
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    const { dropCollections, includeTasks, includeFolders, includeTags, includeUsers, includeRoles } = req.body;
    
    // WARNING: This is destructive!
    if (dropCollections) {
      if (includeRoles) await req.db.collection('roles').deleteMany({});
      if (includeUsers) await req.db.collection('users').deleteMany({});
      if (includeTags) await req.db.collection('tags').deleteMany({});
      if (includeFolders) await req.db.collection('folders').deleteMany({});
      if (includeTasks) await req.db.collection('tasks').deleteMany({});
    }
    
    const results = {};
    
    // Restore in correct order due to references
    if (includeRoles && backup.roles) {
      const result = await req.db.collection('roles').insertMany(
        backup.roles.map(role => ({ ...role, _id: new ObjectId(role._id) })),
        { ordered: false }
      );
      results.roles = result.insertedCount;
    }
    
    if (includeUsers && backup.users) {
      const result = await req.db.collection('users').insertMany(
        backup.users.map(user => ({
          ...user,
          _id: new ObjectId(user._id),
          roles: user.roles.map(r => new ObjectId(r))
        })),
        { ordered: false }
      );
      results.users = result.insertedCount;
    }
    
    if (includeTags && backup.tags) {
      const result = await req.db.collection('tags').insertMany(
        backup.tags.map(tag => ({
          ...tag,
          _id: new ObjectId(tag._id),
          tasks: tag.tasks ? tag.tasks.map(t => new ObjectId(t)) : []
        })),
        { ordered: false }
      );
      results.tags = result.insertedCount;
    }
    
    if (includeFolders && backup.folders) {
      const result = await req.db.collection('folders').insertMany(
        backup.folders.map(folder => ({
          ...folder,
          _id: new ObjectId(folder._id),
          tasks: folder.tasks ? folder.tasks.map(t => new ObjectId(t)) : []
        })),
        { ordered: false }
      );
      results.folders = result.insertedCount;
    }
    
    if (includeTasks && backup.tasks) {
      const result = await req.db.collection('tasks').insertMany(
        backup.tasks.map(task => ({
          ...task,
          _id: new ObjectId(task._id),
          folders: task.folders ? task.folders.map(f => new ObjectId(f)) : [],
          tags: task.tags ? task.tags.map(t => new ObjectId(t)) : [],
          owner: task.owner ? new ObjectId(task.owner) : null
        })),
        { ordered: false }
      );
      results.tasks = result.insertedCount;
    }
    
    res.json({
      message: 'Backup restored successfully',
      restored: results
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error while restoring backup' });
  }
});

module.exports = router;