import type { RowDataPacket } from 'mysql2';
import { createConnection } from 'mysql2/promise';

import { parseBootstrapEnvironment } from '@/infrastructure/config/environment';
import {
  createAuditRuntimeGrantStatements,
  createBootstrapStatements,
  createReportingRuntimeGrantStatements,
  requiredAuditTables,
  requiredReportingTables,
} from '@/infrastructure/database/bootstrap';

const environment = parseBootstrapEnvironment(process.env);
const connection = await createConnection({
  host: environment.administrator.host,
  port: environment.administrator.port,
  user: environment.administrator.user,
  password: environment.administrator.password,
  connectTimeout: 5_000,
  timezone: 'Z',
});

try {
  for (const statement of createBootstrapStatements(environment)) {
    await connection.query(statement);
  }

  const requiredTables = requiredAuditTables(environment);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT TABLE_SCHEMA AS tableSchema, TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA IN (?, ?, ?)`,
    [environment.database.name, environment.audit.primarySchema, environment.audit.sinkSchema],
  );
  const existingTables = new Set(
    rows.map((row) => `${String(row.tableSchema)}.${String(row.tableName)}`),
  );

  if ([...requiredTables].every((table) => existingTables.has(table))) {
    for (const statement of createAuditRuntimeGrantStatements(environment)) {
      await connection.query(statement);
    }
    console.info('Audit table grants are ready.');
  } else {
    console.info('Audit table grants will be applied after the audit migration.');
  }

  const reportingTables = requiredReportingTables(environment);
  if ([...reportingTables].every((table) => existingTables.has(table))) {
    for (const statement of createReportingRuntimeGrantStatements(environment)) {
      await connection.query(statement);
    }
    console.info('Reporting source-table grants are ready.');
  } else {
    console.info('Reporting grants will be applied after source migrations.');
  }

  console.info('Databases and least-privilege users are ready.');
} finally {
  await connection.end();
}
