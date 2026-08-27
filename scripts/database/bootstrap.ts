import { createConnection } from 'mysql2/promise';

import { parseBootstrapEnvironment } from '@/infrastructure/config/environment';
import { createBootstrapStatements } from '@/infrastructure/database/bootstrap';

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

  console.info('Database and least-privilege users are ready.');
} finally {
  await connection.end();
}
