import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class DataService {
  public baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Data Source Operations
  connectToSqlServer(credentials: SqlConnectionCredentials): Observable<string> {
    return this.http.post(
      `${this.baseUrl}${environment.endpoints.dataSource.connectSqlServer}`, 
      credentials,
      { 
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'text'
      }
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
    );
  }

  uploadExcel(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post(
      `${this.baseUrl}${environment.endpoints.dataSource.uploadExcel}`, 
      formData,
      { responseType: 'text' }
    );
  }

  downloadExcelTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}${environment.endpoints.dataSource.downloadTemplate}`,
      { responseType: 'blob' }
    );
  }

  // Metadata Operations
  getAllTables(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}${environment.endpoints.metaData.getTables}`);
  }

  getTableColumns(tableName: string): Observable<TableColumn[]> {
    return this.http.get<TableColumn[]>(`${this.baseUrl}${environment.endpoints.metaData.getColumns}/${tableName}`);
  }

  getTableData(tableName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}${environment.endpoints.metaData.getTableData}/${tableName}`);
  }

  runQuery(query: string): Observable<any[]> {
    console.log('Sending query with exact case:', query);
    // JSON.stringify preserves the exact case of the string
    const jsonQuery = JSON.stringify(query);
    console.log('JSON stringified query:', jsonQuery);
    
    return this.http.post<any[]>(
      `${this.baseUrl}${environment.endpoints.metaData.runQuery}`,
      jsonQuery,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }
}