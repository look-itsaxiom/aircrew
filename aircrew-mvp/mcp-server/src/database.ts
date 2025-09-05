import sqlite3 from "sqlite3";

export interface AgentMessage {
  id: string;
  from: string;
  to: "PM" | "DEV";
  type: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
  content: string;
  taskId?: string;
  read: boolean;
  timestamp: Date;
}

export class Database {
  private db: sqlite3.Database | null = null;
  private ready = false;

  constructor(private dbPath: string) {}

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables()
          .then(() => {
            this.ready = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const runAsync = promisify(this.db.run.bind(this.db));

    // Messages table for agent communication
    await runAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        message_type TEXT NOT NULL,
        content TEXT NOT NULL,
        task_id TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table (for future use)
    await runAsync(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        requirements TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    // Tasks table (for future use)
    await runAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        acceptance_criteria TEXT,
        assigned_to TEXT DEFAULT 'DEV',
        status TEXT DEFAULT 'pending',
        dependencies TEXT,
        files_to_modify TEXT,
        estimated_lines INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )
    `);
  }

  async insertMessage(message: Omit<AgentMessage, "id" | "timestamp">): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO messages (id, from_agent, to_agent, message_type, content, task_id, read) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [messageId, message.from, message.to, message.type, message.content, message.taskId || null, 0],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(messageId);
          }
        }
      );
    });
  }

  async getMessages(agentRole: "PM" | "DEV", markAsRead = true): Promise<AgentMessage[]> {
    if (!this.db) throw new Error("Database not initialized");

    // Get unread messages for the agent
    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM messages 
         WHERE to_agent = ? AND read = 0 
         ORDER BY created_at ASC`,
        [agentRole],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    const messages: AgentMessage[] = rows.map((row) => ({
      id: row.id,
      from: row.from_agent,
      to: row.to_agent,
      type: row.message_type,
      content: row.content,
      taskId: row.task_id,
      read: Boolean(row.read),
      timestamp: new Date(row.created_at),
    }));

    // Mark messages as read if requested
    if (markAsRead && messages.length > 0) {
      const messageIds = messages.map((m) => m.id);
      const placeholders = messageIds.map(() => "?").join(",");
      await new Promise<void>((resolve, reject) => {
        this.db!.run(`UPDATE messages SET read = 1 WHERE id IN (${placeholders})`, messageIds, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    return messages;
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      this.db!.close((err) => {
        if (err) console.error("Error closing database:", err);
        this.ready = false;
        resolve();
      });
    });
  }
}
