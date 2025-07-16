import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DataService, SqlConnectionCredentials, PostgresConnectionCredentials, TableColumn } from '../../services/data.service';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  encapsulation: ViewEncapsulation.None
})
export class HomeComponent implements OnInit, OnDestroy {
  activeTab: string = 'dashboard';
  connectionStatus: string = '';
  isConnected: boolean = false;
  isLoading: boolean = false;

  // Connection health monitoring
  private healthSubscription: Subscription = new Subscription();
  private retryCount: number = 0;
  private maxRetries: number = 3;

  // Modal state
  showConnectionModal: boolean = false;
  connectionTab: string = 'database'; // Changed from 'sqlserver' to 'database'

  // Mobile responsive state
  mobileSidebarOpen: boolean = false;

  // UPDATED: Single database form instead of separate forms
  selectedDatabaseType: string = 'sqlserver';
  databaseForm: FormGroup;
  showPassword: boolean = false;
  connectionTestResult: string = '';
  connectionTestSuccess: boolean = false;

  // File upload
  selectedFile: File | null = null;

  // Metadata
  tables: string[] = [];
  selectedTable: string = '';
  columns: TableColumn[] = [];
  tableData: any[] = [];
  
  // Query
  customQuery: string = '';
  queryResults: any[] = [];

  constructor(
    private dataService: DataService,
    private fb: FormBuilder
  ) {
    // UPDATED: Single unified database form
    this.databaseForm = this.fb.group({
      host: ['', [Validators.required]],
      port: [1433, [Validators.required, Validators.min(1), Validators.max(65535)]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      database: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Subscribe to connection health monitoring
    this.healthSubscription.add(
      this.dataService.connectionHealth$.subscribe(isHealthy => {
        if (this.isConnected !== isHealthy) {
          this.isConnected = isHealthy;
          if (!isHealthy && this.connectionStatus.includes('success')) {
            this.connectionStatus = 'Connection lost - attempting to reconnect...';
          }
        }
      })
    );

    // Check initial connection health
    this.checkConnectionHealth();
    
    // Set initial port based on default database type
    this.onDatabaseTypeChange();
  }

  ngOnDestroy(): void {
    this.healthSubscription.unsubscribe();
    this.dataService.stopHealthMonitoring();
  }

  // NEW: Database type change handler
  onDatabaseTypeChange(): void {
    const defaultPort = this.selectedDatabaseType === 'sqlserver' ? 1433 : 5432;
    this.databaseForm.patchValue({ port: defaultPort });
    this.connectionTestResult = '';
    this.connectionTestSuccess = false;
  }

  // NEW: Password visibility toggle
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleDatabaseType(): void {
    this.selectedDatabaseType = this.selectedDatabaseType === 'sqlserver' ? 'postgresql' : 'sqlserver';
    this.onDatabaseTypeChange();
  }

  // NEW: Test connection before actual connection
  testConnection(): void {
    if (this.databaseForm.valid) {
      this.isLoading = true;
      this.connectionTestResult = '';
      
      const credentials = this.databaseForm.value;
      console.log(`Testing ${this.selectedDatabaseType} connection...`);
      
      const connectionMethod = this.selectedDatabaseType === 'sqlserver' 
        ? this.dataService.connectToSqlServer(credentials as SqlConnectionCredentials)
        : this.dataService.connectToPostgres(credentials as PostgresConnectionCredentials);
      
      this.executeWithRetry(async () => {
        return connectionMethod.toPromise();
      }).then(response => {
        console.log('Connection test response:', response);
        this.connectionTestResult = response || 'Connection test successful';
        this.connectionTestSuccess = this.isSuccessResponse(this.connectionTestResult);
        this.isLoading = false;
      }).catch(error => {
        console.error('Connection test error:', error);
        this.connectionTestResult = `Test failed: ${error.message}`;
        this.connectionTestSuccess = false;
        this.isLoading = false;
      });
    }
  }

  // UPDATED: Unified database connection method
  connectToDatabase(): void {
    if (this.databaseForm.valid) {
      this.isLoading = true;
      const credentials = this.databaseForm.value;
      
      console.log(`Connecting to ${this.selectedDatabaseType} with:`, credentials);
      
      const connectionMethod = this.selectedDatabaseType === 'sqlserver' 
        ? this.dataService.connectToSqlServer(credentials as SqlConnectionCredentials)
        : this.dataService.connectToPostgres(credentials as PostgresConnectionCredentials);
      
      this.executeWithRetry(async () => {
        return connectionMethod.toPromise();
      }).then(response => {
        console.log(`${this.selectedDatabaseType} connection response:`, response);
        this.connectionStatus = response || 'Connected successfully';
        this.isConnected = this.isSuccessResponse(this.connectionStatus);
        this.isLoading = false;
        
        if (this.isConnected) {
          this.loadTables();
          this.closeConnectionModal();
        }
      }).catch(error => {
        console.error(`${this.selectedDatabaseType} connection error:`, error);
        this.connectionStatus = `Error: ${error.message}`;
        this.isConnected = false;
        this.isLoading = false;
      });
    }
  }

  // LEGACY: Keep these methods for backward compatibility
  connectToSqlServer(): void {
    this.selectedDatabaseType = 'sqlserver';
    this.connectToDatabase();
  }

  connectToPostgres(): void {
    this.selectedDatabaseType = 'postgresql';
    this.connectToDatabase();
  }

  private async checkConnectionHealth(): Promise<void> {
    try {
      const health = await this.dataService.checkConnectionHealth().toPromise();
      this.isConnected = health?.isHealthy || false;
      if (!this.isConnected && !this.connectionStatus) {
        this.connectionStatus = 'Not connected';
      }
    } catch (error) {
      this.isConnected = false;
      if (!this.connectionStatus) {
        this.connectionStatus = 'Not connected';
      }
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('All retry attempts failed');
  }

  // Modal Methods
  openConnectionModal(): void {
    this.showConnectionModal = true;
    this.connectionTestResult = '';
  }

  closeConnectionModal(): void {
    this.showConnectionModal = false;
    this.connectionTestResult = '';
    this.showPassword = false;
  }

  // Mobile Sidebar Methods
  toggleMobileSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen = false;
  }

  setActiveTab(tab: string): void {
    if (tab !== 'dashboard' && !this.isConnected) {
      return;
    }
    
    this.activeTab = tab;
    this.closeMobileSidebar();
    
    if (tab === 'metadata' || tab === 'tables') {
      if (this.isConnected && this.tables.length === 0) {
        this.loadTables();
      }
    }
  }

  // Data loading methods
  loadTables(): void {
    this.isLoading = true;
    console.log('Loading tables...');
    
    this.executeWithRetry(async () => {
      return this.dataService.getAllTables().toPromise();
    }).then(tables => {
      console.log('Tables response:', tables);
      this.tables = tables || [];
      console.log('Loaded tables:', this.tables);
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading tables:', error);
      this.tables = [];
      this.isLoading = false;
      
      if (this.tables.length === 0 && this.isConnected) {
        this.connectionStatus = `Connected but cannot load tables: ${error.message}`;
      }
    });
  }

  loadTableColumns(): void {
    console.log('Loading columns for table:', this.selectedTable);
    
    this.executeWithRetry(async () => {
      return this.dataService.getTableColumns(this.selectedTable).toPromise();
    }).then(columns => {
      console.log('Columns response:', columns);
      this.columns = columns || [];
      console.log('Loaded columns:', this.columns);
    }).catch(error => {
      console.error('Error loading columns:', error);
      this.columns = [];
    });
  }

  loadTableData(): void {
    console.log('Loading data for table:', this.selectedTable);
    
    this.executeWithRetry(async () => {
      return this.dataService.getTableData(this.selectedTable).toPromise();
    }).then(data => {
      console.log('Table data response:', data);
      this.tableData = data || [];
      console.log('Loaded table data:', this.tableData);
    }).catch(error => {
      console.error('Error loading table data:', error);
      this.tableData = [];
    });
  }

  runCustomQuery(): void {
    if (this.customQuery.trim()) {
      this.isLoading = true;
      console.log('Running query (exact case):', this.customQuery);
      
      this.executeWithRetry(async () => {
        return this.dataService.runQuery(this.customQuery).toPromise();
      }).then(results => {
        console.log('Query response:', results);
        this.queryResults = results || [];
        console.log('Query results:', this.queryResults);
        this.isLoading = false;
      }).catch(error => {
        console.error('Error running query:', error);
        this.queryResults = [];
        this.isLoading = false;
        
        alert(`Query failed: ${error.message}`);
      });
    }
  }

  // File upload methods
  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  uploadExcel(): void {
    if (this.selectedFile) {
      this.isLoading = true;
      
      console.log('Uploading Excel file:', this.selectedFile.name);
      
      this.executeWithRetry(async () => {
        return this.dataService.uploadExcel(this.selectedFile!).toPromise();
      }).then(response => {
        console.log('Excel upload response:', response);
        this.connectionStatus = response || 'Excel uploaded successfully';
        this.isConnected = this.isSuccessResponse(this.connectionStatus);
        this.isLoading = false;
        this.selectedFile = null;
        
        if (this.isConnected) {
          this.loadTables();
          this.closeConnectionModal();
        }
      }).catch(error => {
        console.error('Excel upload error:', error);
        this.connectionStatus = `Error: ${error.message}`;
        this.isConnected = false;
        this.isLoading = false;
      });
    }
  }

  downloadTemplate(): void {
    this.dataService.downloadExcelTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'TableTemplate.xlsx';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error: any) => {
        console.error('Error downloading template:', error);
      }
    });
  }

  selectTable(tableName: string): void {
    this.selectedTable = tableName;
    this.onTableSelected();
  }

  onTableSelected(): void {
    if (this.selectedTable) {
      this.loadTableColumns();
      this.loadTableData();
    }
  }

  clearQuery(): void {
    this.customQuery = '';
    this.queryResults = [];
  }

  // Utility Methods
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  isSuccessResponse(message: string): boolean {
    const successKeywords = ['success', 'connected', 'created', 'uploaded'];
    const errorKeywords = ['error', 'failed', 'invalid', 'not found'];
    
    const lowerMessage = message.toLowerCase();
    
    if (errorKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return false;
    }
    
    if (successKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return true;
    }
    
    return !lowerMessage.includes('error');
  }

  debugConnection(): void {
    console.log('=== DEBUG INFO ===');
    console.log('Connection Status:', this.connectionStatus);
    console.log('Is Connected:', this.isConnected);
    console.log('Selected Database Type:', this.selectedDatabaseType);
    console.log('Database Form Value:', this.databaseForm.value);
    console.log('Tables:', this.tables);
    console.log('Selected Table:', this.selectedTable);
    console.log('Columns:', this.columns);
    console.log('Table Data Length:', this.tableData.length);
    console.log('API Base URL:', this.dataService.baseUrl);
    console.log('=================');
    
    alert(`Debug Info:
Connection Status: ${this.connectionStatus}
Is Connected: ${this.isConnected}
Database Type: ${this.selectedDatabaseType}
Tables Count: ${this.tables.length}
API URL: ${this.dataService.baseUrl}
Check browser console for detailed logs`);
  }
}