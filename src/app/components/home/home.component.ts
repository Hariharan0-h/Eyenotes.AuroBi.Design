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
  connectionTab: string = 'sqlserver';

  // Mobile responsive state
  mobileSidebarOpen: boolean = false;

  // Data Source Forms
  sqlServerForm: FormGroup;
  postgresForm: FormGroup;
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
    this.sqlServerForm = this.fb.group({
      host: ['', [Validators.required]],
      port: [1433, [Validators.required, Validators.min(1), Validators.max(65535)]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      database: ['', [Validators.required]]
    });

    this.postgresForm = this.fb.group({
      host: ['', [Validators.required]],
      port: [5432, [Validators.required, Validators.min(1), Validators.max(65535)]],
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
  }

  ngOnDestroy(): void {
    this.healthSubscription.unsubscribe();
    this.dataService.stopHealthMonitoring();
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

  // Connection Methods with Retry Logic
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('All retry attempts failed');
  }

  connectToSqlServer(): void {
    if (this.sqlServerForm.valid) {
      this.isLoading = true;
      const credentials: SqlConnectionCredentials = this.sqlServerForm.value;
      
      console.log('Connecting to SQL Server with:', credentials);
      
      this.executeWithRetry(async () => {
        return this.dataService.connectToSqlServer(credentials).toPromise();
      }).then(response => {
        console.log('SQL Server response:', response);
        this.connectionStatus = response || 'Connected successfully';
        this.isConnected = this.isSuccessResponse(this.connectionStatus);
        this.isLoading = false;
        
        if (this.isConnected) {
          this.loadTables();
          this.closeConnectionModal();
        }
      }).catch(error => {
        console.error('SQL Server connection error:', error);
        this.connectionStatus = `Error: ${error.message}`;
        this.isConnected = false;
        this.isLoading = false;
      });
    }
  }

  connectToPostgres(): void {
    if (this.postgresForm.valid) {
      this.isLoading = true;
      const credentials: PostgresConnectionCredentials = this.postgresForm.value;
      
      console.log('Connecting to PostgreSQL with:', credentials);
      
      this.executeWithRetry(async () => {
        return this.dataService.connectToPostgres(credentials).toPromise();
      }).then(response => {
        console.log('PostgreSQL response:', response);
        this.connectionStatus = response || 'Connected successfully';
        this.isConnected = this.isSuccessResponse(this.connectionStatus);
        this.isLoading = false;
        
        if (this.isConnected) {
          this.loadTables();
          this.closeConnectionModal();
        }
      }).catch(error => {
        console.error('PostgreSQL connection error:', error);
        this.connectionStatus = `Error: ${error.message}`;
        this.isConnected = false;
        this.isLoading = false;
      });
    }
  }

  // Enhanced data loading with error handling
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
      
      // Update connection status if tables can't be loaded
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
        
        // Show user-friendly error message
        alert(`Query failed: ${error.message}`);
      });
    }
  }

  // Rest of the methods remain the same...
  
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

  // Modal Methods
  openConnectionModal(): void {
    this.showConnectionModal = true;
  }

  closeConnectionModal(): void {
    this.showConnectionModal = false;
  }

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
    console.log('Tables:', this.tables);
    console.log('Selected Table:', this.selectedTable);
    console.log('Columns:', this.columns);
    console.log('Table Data Length:', this.tableData.length);
    console.log('API Base URL:', this.dataService.baseUrl);
    console.log('=================');
    
    alert(`Debug Info:
Connection Status: ${this.connectionStatus}
Is Connected: ${this.isConnected}
Tables Count: ${this.tables.length}
API URL: ${this.dataService.baseUrl}
Check browser console for detailed logs`);
  }
}