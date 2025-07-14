export const environment = {
  production: true,
  apiUrl: 'https://your-production-api-url.com/api', // Update this to your production API URL
  endpoints: {
    dataSource: {
      connectSqlServer: '/DataSource/connect-sqlserver',
      connectPostgres: '/DataSource/connect-postgres',
      uploadExcel: '/DataSource/upload-excel',
      downloadTemplate: '/DataSource/template-excel'
    },
    metaData: {
      getTables: '/MetaData/tables',
      getColumns: '/MetaData/columns',
      getTableData: '/MetaData/data',
      runQuery: '/MetaData/run-query'
    }
  }
};