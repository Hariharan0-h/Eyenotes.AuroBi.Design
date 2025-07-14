import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DataService, SqlConnectionCredentials, PostgresConnectionCredentials, TableColumn } from '../../services/data.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  encapsulation: ViewEncapsulation.None  // 🔥 THIS IS THE KEY FIX!
})
export class HomeComponent implements OnInit {
  activeTab: string = 'dashboard';
  connectionStatus: string = '';
  isConnected: boolean = false;
  isLoading: boolean = false;

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
    // Initialize component
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
      return; // Prevent navigation to data tabs when not connected
    }
    
    this.activeTab = tab;
    
    // Close mobile sidebar when tab is selected
    this.closeMobileSidebar();
    
    // Auto-load data when switching to relevant tabs
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

  // Data Source Connection Methods
  connectToSqlServer(): void {
    if (this.sqlServerForm.valid) {
      this.isLoading = true;
      const credentials: SqlConnectionCredentials = this.sqlServerForm.value;
      
      console.log('Connecting to SQL Server with:', credentials);
      
      this.dataService.connectToSqlServer(credentials).subscribe({
        next: (response: string) => {
          console.log('SQL Server response:', response);
          this.connectionStatus = response;
          this.isConnected = this.isSuccessResponse(response);
          this.isLoading = false;
          
          if (this.isConnected) {
            this.loadTables(); // Auto-load tables on successful connection
            this.closeConnectionModal();
          }
        },
        error: (error: any) => {
          console.error('SQL Server connection error:', error);
          this.connectionStatus = `Error: ${this.extractErrorMessage(error)}`;
          this.isConnected = false;
          this.isLoading = false;
        }
      });
    }
  }

  connectToPostgres(): void {
    if (this.postgresForm.valid) {
      this.isLoading = true;
      const credentials: PostgresConnectionCredentials = this.postgresForm.value;
      
      console.log('Connecting to PostgreSQL with:', credentials);
      
      this.dataService.connectToPostgres(credentials).subscribe({
        next: (response: string) => {
          console.log('PostgreSQL response:', response);
          this.connectionStatus = response;
          this.isConnected = this.isSuccessResponse(response);
          this.isLoading = false;
          
          if (this.isConnected) {
            this.loadTables(); // Auto-load tables on successful connection
            this.closeConnectionModal();
          }
        },
        error: (error: any) => {
          console.error('PostgreSQL connection error:', error);
          this.connectionStatus = `Error: ${this.extractErrorMessage(error)}`;
          this.isConnected = false;
          this.isLoading = false;
        }
      });
    }
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  uploadExcel(): void {
    if (this.selectedFile) {
      this.isLoading = true;
      
      console.log('Uploading Excel file:', this.selectedFile.name);
      
      this.dataService.uploadExcel(this.selectedFile).subscribe({
        next: (response: string) => {
          console.log('Excel upload response:', response);
          this.connectionStatus = response;
          this.isConnected = this.isSuccessResponse(response);
          this.isLoading = false;
          this.selectedFile = null;
          
          if (this.isConnected) {
            this.loadTables(); // Auto-load tables on successful upload
            this.closeConnectionModal();
          }
        },
        error: (error: any) => {
          console.error('Excel upload error:', error);
          this.connectionStatus = `Error: ${this.extractErrorMessage(error)}`;
          this.isConnected = false;
          this.isLoading = false;
        }
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

  // Metadata Methods
  loadTables(): void {
    this.isLoading = true;
    console.log('Loading tables...');
    
    this.dataService.getAllTables().subscribe({
      next: (tables: string[]) => {
        console.log('Tables response:', tables);
        this.tables = tables;
        console.log('Loaded tables:', this.tables);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading tables:', error);
        this.tables = [];
        this.isLoading = false;
        
        // Show error in connection status if no tables can be loaded
        if (this.tables.length === 0) {
          this.connectionStatus = `Connected but cannot load tables: ${this.extractErrorMessage(error)}`;
        }
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

  loadTableColumns(): void {
    console.log('Loading columns for table:', this.selectedTable);
    
    this.dataService.getTableColumns(this.selectedTable).subscribe({
      next: (columns: TableColumn[]) => {
        console.log('Columns response:', columns);
        this.columns = columns;
        console.log('Loaded columns:', this.columns);
      },
      error: (error: any) => {
        console.error('Error loading columns:', error);
        this.columns = [];
      }
    });
  }

  loadTableData(): void {
    console.log('Loading data for table:', this.selectedTable);
    
    this.dataService.getTableData(this.selectedTable).subscribe({
      next: (data: any[]) => {
        console.log('Table data response:', data);
        this.tableData = data;
        console.log('Loaded table data:', this.tableData);
      },
      error: (error: any) => {
        console.error('Error loading table data:', error);
        this.tableData = [];
      }
    });
  }

  // Query Methods
  runCustomQuery(): void {
    if (this.customQuery.trim()) {
      this.isLoading = true;
      console.log('Running query (exact case):', this.customQuery);
      
      // Pass the query exactly as typed, preserve case sensitivity
      this.dataService.runQuery(this.customQuery).subscribe({
        next: (results: any[]) => {
          console.log('Query response:', results);
          this.queryResults = results;
          console.log('Query results:', this.queryResults);
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Error running query:', error);
          this.queryResults = [];
          this.isLoading = false;
        }
      });
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

  getFormErrors(form: FormGroup): string[] {
    const errors: string[] = [];
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control && control.invalid && control.touched) {
        errors.push(`${key} is required`);
      }
    });
    return errors;
  }

  // Response handling utilities
  extractErrorMessage(error: any): string {
    if (error.error) {
      if (typeof error.error === 'string') {
        return error.error;
      } else if (error.error.message) {
        return error.error.message;
      } else if (error.error.title) {
        return error.error.title;
      }
    }
    return error.message || error.statusText || 'Unknown error occurred';
  }

  isSuccessResponse(message: string): boolean {
    // Determine if the response indicates success
    const successKeywords = ['success', 'connected', 'created', 'uploaded'];
    const errorKeywords = ['error', 'failed', 'invalid', 'not found'];
    
    const lowerMessage = message.toLowerCase();
    
    // Check for error keywords first
    if (errorKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return false;
    }
    
    // Then check for success keywords
    if (successKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return true;
    }
    
    // If no clear indicators, assume success if no "error" mentioned
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
    
    // Show alert with key info
    alert(`Debug Info:
Connection Status: ${this.connectionStatus}
Is Connected: ${this.isConnected}
Tables Count: ${this.tables.length}
API URL: ${this.dataService.baseUrl}
Check browser console for detailed logs`);
  }
}