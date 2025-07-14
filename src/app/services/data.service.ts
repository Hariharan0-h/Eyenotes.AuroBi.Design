import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, timer, switchMap, catchError, of, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SqlConnectionCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface PostgresConnectionCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  character_maximum_length?: number;
  is_nullable: string;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  error?: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  public baseUrl = environment.apiUrl;
  
  // Connection state management
  private connectionHealthSubject = new BehaviorSubject<boolean>(false);
  public connectionHealth$ = this.connectionHealthSubject.asObservable();
  
  private healthCheckInterval: any;

  constructor(private http: HttpClient) {
    this.startHealthMonitoring();
  }

  // Connection Health Monitoring
  private startHealthMonitoring(): void {
    // Check connection health every 30 seconds
    this.healthCheckInterval = timer(0, 30000).pipe(
      switchMap(() => this.checkConnectionHealth()),
      catchError(() => of({ isHealthy: false, timestamp: new Date() }))
    ).subscribe(health => {
      this.connectionHealthSubject.next(health.isHealthy);
    });
  }

  checkConnectionHealth(): Observable<ConnectionHealth> {
    return this.http.get<ConnectionHealth>(`${this.baseUrl}/Health/connection`);
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      this.healthCheckInterval.unsubscribe();
    }
  }

  // Data Source Operations with improved error handling
  connectToSqlServer(credentials: SqlConnectionCredentials): Observable<string> {
    return this.http.post(
      `${this.baseUrl}${environment.endpoints.dataSource.connectSqlServer}`, 
      credentials,
      { 
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'text'
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  connectToPostgres(credentials: PostgresConnectionCredentials): Observable<string> {
    return this.http.post(
      `${this.baseUrl}${environment.endpoints.dataSource.connectPostgres}`, 
      credentials,
      { 
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'text'
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  uploadExcel(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post(
      `${this.baseUrl}${environment.endpoints.dataSource.uploadExcel}`, 
      formData,
      { responseType: 'text' }
    ).pipe(
      catchError(this.handleError)
    );
  }

  downloadExcelTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}${environment.endpoints.dataSource.downloadTemplate}`,
      { responseType: 'blob' }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Metadata Operations with retry logic
  getAllTables(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}${environment.endpoints.metaData.getTables}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getTableColumns(tableName: string): Observable<TableColumn[]> {
    return this.http.get<TableColumn[]>(`${this.baseUrl}${environment.endpoints.metaData.getColumns}/${tableName}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getTableData(tableName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}${environment.endpoints.metaData.getTableData}/${tableName}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  runQuery(query: string): Observable<any[]> {
    console.log('Sending query with exact case:', query);
    const jsonQuery = JSON.stringify(query);
    console.log('JSON stringified query:', jsonQuery);
    
    return this.http.post<any[]>(
      `${this.baseUrl}${environment.endpoints.metaData.runQuery}`,
      jsonQuery,
      { 
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        // Increase timeout for long-running queries
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Enhanced error handling
  private handleError = (error: HttpErrorResponse): Observable<any> => {
    console.error('HTTP Error:', error);
    
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.status === 404) {
        errorMessage = 'Service not found. Please check the API endpoint.';
      } else if (error.error) {
        errorMessage = typeof error.error === 'string' ? error.error : error.error.message || error.message;
      } else {
        errorMessage = `Server Error (${error.status}): ${error.message}`;
      }
    }
    
    // Update connection health on error
    this.connectionHealthSubject.next(false);
    
    throw new Error(errorMessage);
  };

  ngOnDestroy(): void {
    this.stopHealthMonitoring();
  }
}