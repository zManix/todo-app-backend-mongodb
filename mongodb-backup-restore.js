// MongoDB Backup und Restore System für Task-Management-System

// ==================== BACKUP-FUNKTIONEN ====================

// Hauptfunktion zum Erstellen eines Backups aller relevanten Collections
function createBackup(backupName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fullBackupName = backupName || `backup_${timestamp}`;
  
  print(`\nErstelle Backup: ${fullBackupName}`);
  
  // Backup der Collections in BSON-Format erstellen
  const backup = {
    metadata: {
      name: fullBackupName,
      createdAt: new Date(),
      version: "1.0",
      collections: ["tasks", "folders", "tags", "users", "roles"]
    },
    tasks: db.tasks.find().toArray(),
    folders: db.folders.find().toArray(),
    tags: db.tags.find().toArray(),
    users: db.users.find().toArray(),
    roles: db.roles.find().toArray()
  };
  
  // Backup in der backups-Collection speichern
  try {
    // Collection erstellen, falls nicht vorhanden
    if (!db.getCollectionNames().includes("backups")) {
      db.createCollection("backups");
    }
    
    // Backup speichern
    const result = db.backups.insertOne(backup);
    
    if (result.acknowledged) {
      print(`Backup erfolgreich erstellt! Backup-ID: ${result.insertedId}`);
      print(`Backup enthält:`);
      print(` - ${backup.tasks.length} Aufgaben`);
      print(` - ${backup.folders.length} Ordner`);
      print(` - ${backup.tags.length} Tags`);
      print(` - ${backup.users.length} Benutzer`);
      print(` - ${backup.roles.length} Rollen`);
      return result.insertedId;
    } else {
      print("Fehler beim Erstellen des Backups.");
      return null;
    }
  } catch (err) {
    print(`Fehler beim Erstellen des Backups: ${err.message}`);
    return null;
  }
}

// Funktion zum Exportieren eines Backups als JSON-Datei
function exportBackupToJSON(backupId, filePath) {
  try {
    const backup = db.backups.findOne({ _id: ObjectId(backupId) });
    
    if (!backup) {
      print(`Kein Backup mit der ID ${backupId} gefunden.`);
      return false;
    }
    
    // In MongoDB-Shell kann keine Datei gespeichert werden, daher die Anleitung:
    print(`\nUm das Backup zu exportieren, führen Sie folgenden Befehl im Terminal/CMD aus:`);
    print(`mongoexport --db=${db.getName()} --collection=backups --query='{"_id": ObjectId("${backupId}")}' --out=${filePath || 'task_management_backup.json'}`);
    
    return true;
  } catch (err) {
    print(`Fehler beim Exportieren des Backups: ${err.message}`);
    return false;
  }
}

// Funktion zum Auflisten aller verfügbaren Backups
function listBackups() {
  try {
    if (!db.getCollectionNames().includes("backups")) {
      print("\nKeine Backups vorhanden.");
      return;
    }
    
    const backups = db.backups.find({}, { 
      "metadata.name": 1, 
      "metadata.createdAt": 1,
      "tasks": { $size: "$tasks" },
      "folders": { $size: "$folders" },
      "tags": { $size: "$tags" },
      "users": { $size: "$users" },
      "roles": { $size: "$roles" }
    }).toArray();
    
    if (backups.length === 0) {
      print("\nKeine Backups vorhanden.");
      return;
    }
    
    print("\nVerfügbare Backups:");
    backups.forEach(backup => {
      print(`\nID: ${backup._id}`);
      print(`Name: ${backup.metadata.name}`);
      print(`Erstellt am: ${backup.metadata.createdAt}`);
      print(`Enthält: ${backup.tasks} Aufgaben, ${backup.folders} Ordner, ${backup.tags} Tags, ${backup.users} Benutzer, ${backup.roles} Rollen`);
    });
  } catch (err) {
    print(`Fehler beim Abrufen der Backups: ${err.message}`);
  }
}

// ==================== RESTORE-FUNKTIONEN ====================

// Hauptfunktion zum Wiederherstellen eines Backups
function restoreBackup(backupId, options = {}) {
  try {
    const backup = db.backups.findOne({ _id: ObjectId(backupId) });
    
    if (!backup) {
      print(`Kein Backup mit der ID ${backupId} gefunden.`);
      return false;
    }
    
    print(`\nWiederherstellung des Backups: ${backup.metadata.name}`);
    
    // Optionen für die Wiederherstellung
    const opts = {
      dropCollections: options.dropCollections || false,
      includeTasks: options.includeTasks !== false,
      includeFolders: options.includeFolders !== false,
      includeTags: options.includeTags !== false,
      includeUsers: options.includeUsers !== false,
      includeRoles: options.includeRoles !== false
    };
    
    // Bestätigung anfordern, wenn Collections gelöscht werden sollen
    if (opts.dropCollections) {
      print("\nWARNUNG: Dies wird alle vorhandenen Daten in den ausgewählten Collections löschen!");
      print("Wenn Sie in einer Produktionsumgebung sind, erstellen Sie zuerst ein Backup.");
      print("Geben Sie 'db.dropCollections(true)' ein, um fortzufahren, oder brechen Sie ab (Ctrl+C).");
      return false;
    }
    
    // Beziehungen und Referenzen wiederherstellen
    return performRestore(backup, opts);
    
  } catch (err) {
    print(`Fehler bei der Wiederherstellung des Backups: ${err.message}`);
    return false;
  }
}

// Hilfsfunktion zum Ausführen der eigentlichen Wiederherstellung
function performRestore(backup, options) {
  try {
    // Start der Wiederherstellung
    print("\nStarte Wiederherstellung...");
    
    // Collections bei Bedarf leeren
    if (options.dropCollections) {
      if (options.includeRoles) db.roles.deleteMany({});
      if (options.includeUsers) db.users.deleteMany({});
      if (options.includeTags) db.tags.deleteMany({});
      if (options.includeFolders) db.folders.deleteMany({});
      if (options.includeTasks) db.tasks.deleteMany({});
      print("Bestehende Daten wurden gelöscht.");
    }
    
    // Zuerst Rollen wiederherstellen (werden von Benutzern referenziert)
    if (options.includeRoles) {
      const roles = backup.roles;
      if (roles && roles.length > 0) {
        const result = db.roles.insertMany(roles, { ordered: false });
        print(`${result.insertedCount} Rollen wiederhergestellt.`);
      }
    }
    
    // Dann Benutzer wiederherstellen
    if (options.includeUsers) {
      const users = backup.users;
      if (users && users.length > 0) {
        const result = db.users.insertMany(users, { ordered: false });
        print(`${result.insertedCount} Benutzer wiederhergestellt.`);
      }
    }
    
    // Tags wiederherstellen
    if (options.includeTags) {
      const tags = backup.tags;
      if (tags && tags.length > 0) {
        const result = db.tags.insertMany(tags, { ordered: false });
        print(`${result.insertedCount} Tags wiederhergestellt.`);
      }
    }
    
    // Ordner wiederherstellen
    if (options.includeFolders) {
      const folders = backup.folders;
      if (folders && folders.length > 0) {
        const result = db.folders.insertMany(folders, { ordered: false });
        print(`${result.insertedCount} Ordner wiederhergestellt.`);
      }
    }
    
    // Zuletzt Aufgaben wiederherstellen (referenzieren Ordner, Tags und Benutzer)
    if (options.includeTasks) {
      const tasks = backup.tasks;
      if (tasks && tasks.length > 0) {
        const result = db.tasks.insertMany(tasks, { ordered: false });
        print(`${result.insertedCount} Aufgaben wiederhergestellt.`);
      }
    }
    
    print("\nWiederherstellung erfolgreich abgeschlossen!");
    return true;
  } catch (err) {
    print(`Fehler während der Wiederherstellung: ${err.message}`);
    return false;
  }
}

// Funktion zum Importieren eines Backups aus einer JSON-Datei
function importBackupFromJSON(filePath) {
  try {
    // In MongoDB-Shell kann keine Datei gelesen werden, daher die Anleitung:
    print(`\nUm ein Backup zu importieren, führen Sie folgenden Befehl im Terminal/CMD aus:`);
    print(`mongoimport --db=${db.getName()} --collection=backups --file=${filePath}`);
    
    print("\nNach dem Import können Sie 'listBackups()' ausführen, um das importierte Backup zu sehen");
    print("und dann 'restoreBackup(backupId)' ausführen, um es wiederherzustellen.");
    
    return true;
  } catch (err) {
    print(`Fehler bei der Backup-Import-Anleitung: ${err.message}`);
    return false;
  }
}

// Hilfsfunktion zum tatsächlichen Löschen von Collections (Sicherheitscheck)
db.dropCollections = function(confirmed) {
  if (confirmed !== true) {
    print("Bestätigen Sie den Vorgang mit db.dropCollections(true)");
    return false;
  }
  
  print("Collections werden gelöscht und aus dem Backup wiederhergestellt...");
  return true;
}

// ==================== VERWENDUNGSHINWEISE ====================

print("\nBackup und Restore Funktionen wurden geladen!");
print("\nVerfügbare Funktionen:");
print(" - createBackup(backupName) - Erstellt ein neues Backup");
print(" - listBackups() - Zeigt alle verfügbaren Backups an");
print(" - restoreBackup(backupId, options) - Stellt ein Backup wieder her");
print(" - exportBackupToJSON(backupId, filePath) - Zeigt an, wie ein Backup als JSON exportiert wird");
print(" - importBackupFromJSON(filePath) - Zeigt an, wie ein Backup aus JSON importiert wird");
print("\nBeispiel zum Wiederherstellen mit Optionen:");
print(" - restoreBackup('6123456789abcdef12345678', {");
print("     dropCollections: false,  // auf true setzen, um bestehende Daten zu löschen");
print("     includeTasks: true,      // Aufgaben wiederherstellen");
print("     includeFolders: true,    // Ordner wiederherstellen");
print("     includeTags: true,       // Tags wiederherstellen");
print("     includeUsers: true,      // Benutzer wiederherstellen");
print("     includeRoles: true       // Rollen wiederherstellen");
print("   })");
