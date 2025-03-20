// MongoDB Benutzer- und Rollenverwaltung für Task-Management-System

// 1. Erstellen einer neuen Sammlung für Benutzer
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "email", "password_hash", "roles", "created_at"],
      properties: {
        username: {
          bsonType: "string",
          description: "Benutzername"
        },
        email: {
          bsonType: "string",
          description: "E-Mail-Adresse des Benutzers"
        },
        password_hash: {
          bsonType: "string",
          description: "Hash des Benutzerpassworts"
        },
        roles: {
          bsonType: "array",
          description: "Array von Rollen-IDs, die dem Benutzer zugewiesen sind"
        },
        created_at: {
          bsonType: "date",
          description: "Erstellungsdatum des Benutzers"
        },
        last_login: {
          bsonType: "date",
          description: "Datum der letzten Anmeldung"
        }
      }
    }
  }
});

// 2. Erstellen einer neuen Sammlung für Rollen
db.createCollection("roles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "permissions", "created_at"],
      properties: {
        name: {
          bsonType: "string",
          description: "Name der Rolle"
        },
        description: {
          bsonType: "string",
          description: "Beschreibung der Rolle"
        },
        permissions: {
          bsonType: "object",
          description: "Berechtigungen für verschiedene Aufgabentypen",
          properties: {
            tasks: {
              bsonType: "object",
              properties: {
                create: { bsonType: "bool" },
                read: { bsonType: "bool" },
                update: { bsonType: "bool" },
                delete: { bsonType: "bool" },
                assign: { bsonType: "bool" }
              }
            },
            folders: {
              bsonType: "object",
              properties: {
                create: { bsonType: "bool" },
                read: { bsonType: "bool" },
                update: { bsonType: "bool" },
                delete: { bsonType: "bool" }
              }
            },
            tags: {
              bsonType: "object",
              properties: {
                create: { bsonType: "bool" },
                read: { bsonType: "bool" },
                update: { bsonType: "bool" },
                delete: { bsonType: "bool" }
              }
            },
            users: {
              bsonType: "object",
              properties: {
                create: { bsonType: "bool" },
                read: { bsonType: "bool" },
                update: { bsonType: "bool" },
                delete: { bsonType: "bool" }
              }
            }
          }
        },
        created_at: {
          bsonType: "date",
          description: "Erstellungsdatum der Rolle"
        },
        updated_at: {
          bsonType: "date",
          description: "Datum der letzten Aktualisierung"
        }
      }
    }
  }
});

// 3. Standardrollen erstellen
const roles = [
  {
    _id: new ObjectId(),
    name: "Admin",
    description: "Administrator mit vollen Berechtigungen",
    permissions: {
      tasks: {
        create: true,
        read: true,
        update: true,
        delete: true,
        assign: true
      },
      folders: {
        create: true,
        read: true,
        update: true,
        delete: true
      },
      tags: {
        create: true,
        read: true,
        update: true,
        delete: true
      },
      users: {
        create: true,
        read: true,
        update: true,
        delete: true
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: new ObjectId(),
    name: "Manager",
    description: "Kann alle Aufgaben verwalten und zuweisen",
    permissions: {
      tasks: {
        create: true,
        read: true,
        update: true,
        delete: true,
        assign: true
      },
      folders: {
        create: true,
        read: true,
        update: true,
        delete: true
      },
      tags: {
        create: true,
        read: true,
        update: true,
        delete: true
      },
      users: {
        create: false,
        read: true,
        update: false,
        delete: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: new ObjectId(),
    name: "Bearbeiter",
    description: "Kann Aufgaben erstellen und bearbeiten",
    permissions: {
      tasks: {
        create: true,
        read: true,
        update: true,
        delete: false,
        assign: false
      },
      folders: {
        create: true,
        read: true,
        update: true,
        delete: false
      },
      tags: {
        create: true,
        read: true,
        update: true,
        delete: false
      },
      users: {
        create: false,
        read: true,
        update: false,
        delete: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: new ObjectId(),
    name: "Mitarbeiter",
    description: "Kann nur zugewiesene Aufgaben sehen und bearbeiten",
    permissions: {
      tasks: {
        create: false,
        read: true,
        update: true,
        delete: false,
        assign: false
      },
      folders: {
        create: false,
        read: true,
        update: false,
        delete: false
      },
      tags: {
        create: false,
        read: true,
        update: false,
        delete: false
      },
      users: {
        create: false,
        read: false,
        update: false,
        delete: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: new ObjectId(),
    name: "Gast",
    description: "Nur Leserechte für Aufgaben",
    permissions: {
      tasks: {
        create: false,
        read: true,
        update: false,
        delete: false,
        assign: false
      },
      folders: {
        create: false,
        read: true,
        update: false,
        delete: false
      },
      tags: {
        create: false,
        read: true,
        update: false,
        delete: false
      },
      users: {
        create: false,
        read: false,
        update: false,
        delete: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Rollen in die Datenbank einfügen
db.roles.insertMany(roles);

// 4. Beispielbenutzer erstellen
// Hinweis: In einer Produktionsumgebung sollten richtige Passwort-Hashes verwendet werden
const adminRoleId = db.roles.findOne({name: "Admin"})._id;
const managerRoleId = db.roles.findOne({name: "Manager"})._id;
const bearbeiterRoleId = db.roles.findOne({name: "Bearbeiter"})._id;
const mitarbeiterRoleId = db.roles.findOne({name: "Mitarbeiter"})._id;
const gastRoleId = db.roles.findOne({name: "Gast"})._id;

const users = [
  {
    username: "admin",
    email: "admin@example.com",
    password_hash: "$2a$10$XYZ...", // In der Produktion einen echten Hash verwenden
    roles: [adminRoleId],
    created_at: new Date()
  },
  {
    username: "manager1",
    email: "manager1@example.com",
    password_hash: "$2a$10$XYZ...",
    roles: [managerRoleId],
    created_at: new Date()
  },
  {
    username: "bearbeiter1",
    email: "bearbeiter1@example.com",
    password_hash: "$2a$10$XYZ...",
    roles: [bearbeiterRoleId],
    created_at: new Date()
  },
  {
    username: "mitarbeiter1",
    email: "mitarbeiter1@example.com",
    password_hash: "$2a$10$XYZ...",
    roles: [mitarbeiterRoleId],
    created_at: new Date()
  },
  {
    username: "gast1",
    email: "gast1@example.com",
    password_hash: "$2a$10$XYZ...",
    roles: [gastRoleId],
    created_at: new Date()
  },
  // Benutzer mit mehreren Rollen
  {
    username: "projektleiter",
    email: "projektleiter@example.com",
    password_hash: "$2a$10$XYZ...",
    roles: [managerRoleId, bearbeiterRoleId],
    created_at: new Date()
  }
];

db.users.insertMany(users);

// 5. Aktualisierung des Task-Schemas um den Besitzer zu verfolgen
db.tasks.updateMany(
  {},
  { $set: { owner: null } }
);

// 6. Erstellen von Indizes für verbesserte Abfrageleistung
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.roles.createIndex({ name: 1 }, { unique: true });

// 7. Erweiterung der Tasks-Collection um den Besitzer (owner) zu speichern
// Beispielhaft die Task-Validierung aktualisieren, um das neue Feld zu berücksichtigen
db.runCommand({
  collMod: "tasks",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "status", "priority", "created_at", "updated_at"],
      properties: {
        // Bestehende Eigenschaften
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        status: { enum: ["todo", "in-progress", "done"] },
        due_date: { bsonType: "date" },
        priority: { enum: ["low", "medium", "high"] },
        assigned_user: { bsonType: "string" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        folders: { bsonType: "array" },
        tags: { bsonType: "array" },
        // Neues Feld für den Besitzer
        owner: { 
          bsonType: ["objectId", "null"],
          description: "Benutzer-ID des Aufgabenbesitzers" 
        }
      }
    }
  }
});

// 8. Beispielhafte Zuweisung von Aufgabenbesitzern
// Holen Sie einige Benutzer aus der Datenbank
const someUsers = db.users.find({}, { _id: 1 }).toArray();

// Aktualisieren Sie einige Aufgaben mit Besitzern
db.tasks.find({}).forEach((task, index) => {
  // Wechseln Sie zwischen Benutzern für verschiedene Aufgaben
  const userIndex = index % someUsers.length;
  db.tasks.updateOne(
    { _id: task._id },
    { $set: { owner: someUsers[userIndex]._id } }
  );
});

// Hilfsfunktionen

// Funktion zum Anzeigen der Rollen eines Benutzers
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

// Funktion zum Prüfen, ob ein Benutzer eine bestimmte Aktion ausführen darf
function canUserPerformAction(userId, resourceType, action) {
  const user = db.users.findOne({ _id: userId });
  if (!user) return false;
  
  // Holen Sie alle Rollen des Benutzers
  const roles = db.roles.find({ _id: { $in: user.roles } }).toArray();
  
  // Prüfen Sie, ob mindestens eine Rolle die angeforderte Aktion zulässt
  return roles.some(role => {
    return role.permissions[resourceType] && 
           role.permissions[resourceType][action] === true;
  });
}

// Funktion zum Prüfen, welche Benutzer eine bestimmte Aufgabe sehen können
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

// Aufgaben auflisten, die ein Benutzer bearbeiten kann
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

// Eine Rolle aktualisieren
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

// Einem Benutzer eine zusätzliche Rolle zuweisen
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

// Einem Benutzer eine Rolle entziehen
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

// Eine Zusammenfassung aller Rollen und ihrer Berechtigungen anzeigen
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

// Die Zugriffsrechte eines bestimmten Benutzers überprüfen
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

// Eine neue Rolle erstellen
function createRole(name, description, permissions) {
  // Prüfen, ob die Rolle bereits existiert
  if (db.roles.findOne({ name: name })) {
    print(`\nRolle ${name} existiert bereits.`);
    return;
  }
  
  // Neue Rolle erstellen
  db.roles.insertOne({
    name: name,
    description: description,
    permissions: permissions,
    created_at: new Date(),
    updated_at: new Date()
  });
  
  print(`\nRolle ${name} wurde erstellt.`);
}

// Einen neuen Benutzer erstellen
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

// Ausgabeinformationen
print(`${db.users.countDocuments()} Benutzer wurden erstellt.`);
print(`${db.roles.countDocuments()} Rollen wurden erstellt.`);

// Zeigen Sie eine Übersicht der Benutzer mit ihren Rollen an
print("\nBenutzerübersicht:");
db.users.find().forEach(user => {
  const userRoles = db.roles.find({ _id: { $in: user.roles } }).toArray().map(r => r.name).join(", ");
  print(`Benutzer: ${user.username}, E-Mail: ${user.email}, Rollen: ${userRoles}`);
});

print("\nBenutzer- und Rollenverwaltung erfolgreich eingerichtet!");
print("\nVerfügbare Funktionen:");
print(" - showUserRoles(username) - Zeigt die Rollen eines Benutzers an");
print(" - canUserPerformAction(userId, resourceType, action) - Prüft Berechtigungen");
print(" - whoCanViewTask(taskId) - Zeigt, welche Benutzer eine Aufgabe sehen können");
print(" - listEditableTasks(username) - Listet Aufgaben auf, die ein Benutzer bearbeiten kann");
print(" - updateRole(roleName, permissionUpdates) - Aktualisiert eine Rolle");
print(" - assignRoleToUser(username, roleName) - Weist einem Benutzer eine Rolle zu");
print(" - removeRoleFromUser(username, roleName) - Entfernt eine Rolle von einem Benutzer");
print(" - showRolesSummary() - Zeigt eine Zusammenfassung aller Rollen");
print(" - checkUserAccess(username) - Zeigt die effektiven Zugriffsrechte eines Benutzers");
print(" - createRole(name, description, permissions) - Erstellt eine neue Rolle");
print(" - createUser(username, email, password, roleNames) - Erstellt einen neuen Benutzer");
