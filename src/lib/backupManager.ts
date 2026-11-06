// Automatic backup export manager
const BACKUP_KEY = 'travelpro_last_backup';
const BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

export class BackupManager {
  private static instance: BackupManager;

  private constructor() {
    this.checkAutoBackup();
  }

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  getLastBackupDate(): Date | null {
    const stored = localStorage.getItem(BACKUP_KEY);
    return stored ? new Date(stored) : null;
  }

  shouldBackup(): boolean {
    const lastBackup = this.getLastBackupDate();
    if (!lastBackup) return true;
    
    const timeSinceBackup = Date.now() - lastBackup.getTime();
    return timeSinceBackup >= BACKUP_INTERVAL;
  }

  async checkAutoBackup() {
    if (this.shouldBackup()) {
      // Auto backup is disabled by default
      // User must manually trigger backups
      console.log('Auto backup available - user can manually export from Settings');
    }
  }

  async createBackup(clients: any[], bookings: any[], expenses: any[], vendors: any[]) {
    const backup = {
      version: '3.1.0',
      timestamp: new Date().toISOString(),
      data: {
        clients: clients || [],
        bookings: bookings || [],
        expenses: expenses || [],
        vendors: vendors || []
      },
      metadata: {
        clientCount: clients?.length || 0,
        bookingCount: bookings?.length || 0,
        expenseCount: expenses?.length || 0,
        vendorCount: vendors?.length || 0,
      }
    };

    return backup;
  }

  async exportBackup(clients: any[], bookings: any[], expenses: any[], vendors: any[]) {
    const backup = await this.createBackup(clients, bookings, expenses, vendors);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelpro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // Update last backup timestamp
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  }

  async importBackup(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target?.result as string);
          
          // Validate backup structure
          if (!backup.data || !backup.version) {
            throw new Error('Invalid backup file format');
          }
          
          resolve(backup);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  getDaysSinceLastBackup(): number | null {
    const lastBackup = this.getLastBackupDate();
    if (!lastBackup) return null;
    
    const days = Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }
}

export const backupManager = BackupManager.getInstance();
