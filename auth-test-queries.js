// Test-Abfragen für die Benutzer- und Rollenverwaltung

// 1. Benutzerrollen anzeigen
function showUserRoles(username) {
  const user = db.users.findOne({ username: username });
  if (!user) {
    print(`Benutzer ${username} nicht gefunden.`);
    return;
  }
  
  const roles = db.roles.find({ _id: { $in: user.roles } }).toArray();
  print(`\nRollen für Benutzer ${username}:`);
  roles.forEach(role => {
    print(` - ${role.name}: ${role.description}`);
    print(`   Berechtigungen:`);
    
    for (const [resourceType, actions] of Object.entries(role.permissions)) {
      print(`   - ${resourceType}:`);
      for (const [action, allowed] of Object.entries(actions)) {
        print(`     - ${action}: ${allowed ? 'Ja' : 'Nein'}`);
      }
    }
  });
}

// 2. Prüfen, welche Benutzer eine bestimmte Aufgabe sehen können
function whoCanViewTask(taskId) {
  const task = db.tasks.findOne({ _id: ObjectId(taskId) });
  if (!task) {
    print(`Aufgabe mit ID ${taskId} nicht gefunden.`);
    return;
  }
  
  print(`\nBenutzer, die die Aufgabe "${task.title}" sehen können:`);
  
  // Alle Benutzer durchlaufen
  db.users.find().forEach(user => {
    let canView = false;
    const roles = db.roles.find({ _id: { $in: user.roles } }).toArray();
    
    // Prüfen, ob der Benutzer Leserechte für Aufgaben hat
    const hasReadPermission = roles.some(role => 
      role.permissions.tasks && role.permissions.tasks.read === true
    );
    
    if (hasReadPermission) {
      // Prüfen, ob der Benutzer Admin oder Manager ist
      const isAdminOrManager = roles.some(role => 
        ["Admin", "Manager"].includes(role.name)
      );
      
      if (isAdminOrManager) {
        canView = true;
      } else {
        // Prüfen, ob die Aufgabe dem Benutzer zugewiesen ist oder er der Besitzer ist
        if (task.assigned_user === user.email) {
          canView = true;
        } else if (task.owner && task.owner.equals(user._id)) {
          canView = true;
        }
      }
    }
    
    if (canView) {
      const userRoles = roles.map(r => r.name).join(", ");
      print(` - ${user.username} (${userRoles})`);
    }
  });
}

// 3. Alle Aufgaben auflisten, die ein bestimmter Benutzer bearbeiten kann
function listEditableTasks(username) {
  const user = db.users.findOne({ username: username });
  if (!user) {
    print(`Benutzer ${username} nicht gefunden.`);
    return;
  }
  
  const roles = db.roles.find({ _id: { $in: user.roles } }).toArray();
  
  // Prüfen, ob der Benutzer Aktualisierungsrechte für Aufgaben hat
  const hasUpdatePermission = roles.some(role => 
    role.permissions.tasks && role.permissions.tasks.update === true
  );
  
  if (!hasUpdatePermission) {
    print(`\nBenutzer ${username} kann keine Aufgaben bearbeiten.`);
    return;
  }
  
  // Prüfen, ob der Benutzer Admin oder Manager ist
  const isAdminOrManager = roles.some(role => 
    ["Admin", "Manager"].includes(role.name)
  );
  
  let tasks;
  if (isAdminOrManager) {
    // Admins und Manager können alle Aufgaben bearbeiten
    tasks = db.tasks.find({}).toArray();
  } else {
    // Andere Benutzer können nur ihre zugewiesenen oder eigenen Aufgaben bearbeiten
    tasks = db.tasks.find({
      $or: [
        { assigned_user: user.email },
        { owner: user._id }
      ]
    }).toArray();
  }
  
  print(`\nAufgaben, die ${username} bearbeiten kann:`);
  if (tasks.length === 0) {
    print(" - Keine Aufgaben gefunden");
  } else {
    tasks.forEach(task => {
      print(` - ${task.title} (Status: ${task.status}, Priorität: ${task.priority})`);
    });
  }
}

// 4. Eine Rolle aktualisieren
function updateRole(roleName, permissionUpdates) {
  const role = db.roles.findOne({ name: roleName });
  if (!role) {
    print(`Rolle ${roleName} nicht gefunden.`);
    return;
  }
  
  // Aktualisieren Sie die Berechtigungen
  let updatedPermissions = { ...role.permissions };
  
  for (const [resourceType, actions] of Object.entries(permissionUpdates)) {
    if (!updatedPermissions[resourceType]) {
      updatedPermissions[resourceType] = {};
    }
    
    for (const [action, allowed] of Object.entries(actions)) {
      updatedPermissions[resourceType][action] = allowed;
    }
  }
  
  // Aktualisieren Sie die Rolle in der Datenbank
  db.roles.updateOne(
    { _id: role._id },
    { 
      $set: { 
        permissions: updatedPermissions,
        updated_at: new Date()
      } 
    }
  );
  
  print(`\nRolle ${roleName} wurde aktualisiert.`);
}

// 5. Einem Benutzer eine zusätzliche Rolle zuweisen
function assignRoleToUser(username, roleName) {
  const user = db.users.findOne({ username: username });
  if (!user) {
    print(`Benutzer ${username} nicht gefunden.`);
    return;
  }
  
  const role = db.roles.findOne({ name: roleName });
  if (!role) {
    print(`Rolle ${roleName} nicht gefunden.`);
    return;
  }
  
  // Prüfen, ob der Benutzer diese Rolle bereits hat
  if (user.roles.some(r => r.equals(role._id))) {
    print(`\nBenutzer ${username} hat bereits die Rolle ${roleName}.`);
    return;
  }
  
  // Dem Benutzer die neue Rolle zuweisen
  db.users.updateOne(
    { _id: user._id },
    { $push: { roles: role._id } }
  );
  
  print(`\nRolle ${roleName} wurde dem Benutzer ${username} zugewiesen.`);
}

// 6. Einem Benutzer eine Rolle entziehen
function removeRoleFromUser(username, roleName) {
  const user = db.users.findOne({ username: username });
  if (!user) {
    print(`Benutzer ${username} nicht gefunden.`);
    return;
  }
  
  const role = db.roles.findOne({ name: roleName });
  if (!role) {
    print(`Rolle ${roleName} nicht gefunden.`);
    return;
  }
  
  // Prüfen, ob der Benutzer diese Rolle hat
  if (!user.roles.some(r => r.equals(role._id))) {
    print(`\nBenutzer ${username} hat nicht die Rolle ${roleName}.`);
    return;
  }
  
  // Die Rolle vom Benutzer entfernen
  db.users.updateOne(
    { _id: user._id },
    { $pull: { roles: role._id } }
  );
  
  print(`\nRolle ${roleName} wurde dem Benutzer ${username} entzogen.`);
}

// 7. Einen neuen Benutzer erstellen
function createUser(username, email, password, roleNames) {
  // Prüfen, ob der Benutzer bereits existiert
  if (db.users.findOne({ $or: [{ username: username }, { email: email }] })) {
    print(`\nBenutzername oder E-Mail existiert bereits.`);
    return;
  }
  
  // Rollen-IDs finden
  const roles = db.roles.find({ name: { $in: roleNames } }).toArray();
  if (roles.length !== roleNames.length) {
    print(`\nEine oder mehrere der angegebenen Rollen wurden nicht gefunden.`);
    return;
  }
  
  // In einer echten Anwendung würde hier ein Passwort-Hash erstellt werden
  const passwordHash = "$2a$10$XYZ..."; // Platzhalter
  
  // Neuen Benutzer erstellen
  db.users.insertOne({
    username: username,
    email: email,
    password_hash: passwordHash,
    roles: roles.map(r => r._id),
    created_at: new Date()
  });
  
  print(`\nBenutzer ${username} wurde mit den Rollen ${roleNames.join(", ")} erstellt.`);
}

// 8. Eine Zusammenfassung aller Rollen und ihrer Berechtigungen anzeigen
function showRolesSummary() {
  print("\nÜbersicht aller Rollen und Berechtigungen:");
  
  db.roles.find().forEach(role => {
    print(`\nRolle: ${role.name}`);
    print(`Beschreibung: ${role.description}`);
    print("Berechtigungen:");
    
    for (const [resourceType, actions] of Object.entries(role.permissions)) {
      print(` - ${resourceType}:`);
      for (const [action, allowed] of Object.entries(actions)) {
        print(`   - ${action}: ${allowed ? 'Ja' : 'Nein'}`);
      }
    }
  });
}

// 9. Die Zugriffsrechte eines bestimmten Benutzers überprüfen
function checkUserAccess(username) {
  const user = db.users.findOne({ username: username });
  if (!user) {
    print(`Benutzer ${username} nicht gefunden.`);
    return;
  }
  
  const roles = db.roles.find({ _id: { $in: user.roles } }).toArray();
  
  // Kombinierte Berechtigungen aus allen Rollen des Benutzers berechnen
  const effectivePermissions = {};
  
  roles.forEach(role => {
    for (const [resourceType, actions] of Object.entries(role.permissions)) {
      if (!effectivePermissions[resourceType]) {
        effectivePermissions[resourceType] = {};
      }
      
      for (const [action, allowed] of Object.entries(actions)) {
        // Wenn irgendeine Rolle die Aktion erlaubt, ist sie erlaubt
        if (allowed === true) {
          effectivePermissions[resourceType][action] = true;
        } else if (effectivePermissions[resourceType][action] !== true) {
          effectivePermissions[resourceType][action] = false;
        }
      }
    }
  });
  
  print(`\nEffektive Zugriffsrechte für Benutzer ${username}:`);
  for (const [resourceType, actions] of Object.entries(effectivePermissions)) {
    print(` - ${resourceType}:`);
    for (const [action, allowed] of Object.entries(actions)) {
      print(`   - ${action}: ${allowed ? 'Ja' : 'Nein'}`);
    }
  }
}

// 10. Eine neue Rolle erstellen
function createRole(name, description, permissions) {
  // Prüfen, ob die Rolle bereits