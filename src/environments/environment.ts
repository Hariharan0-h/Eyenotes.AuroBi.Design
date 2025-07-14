export const environment = {
  production: false,
  apiUrl: 'https://localhost:7246/api',
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
    },
    health: {
      connection: '/Health/connection'
    }
  }
};