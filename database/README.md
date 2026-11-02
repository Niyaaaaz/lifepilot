# LifePilot MongoDB schema

`schema.prisma` defines the MongoDB collections, ObjectId fields, indexes, and relations used by the API. MongoDB does not use Prisma SQL migrations. The old PostgreSQL migrations are archived in `postgresql-migrations/` and are not applied by this project.

MongoDB Compass is the client; install and run MongoDB Community Server locally. Prisma requires a replica set for transactions. In the MongoDB service config (`mongod.cfg`), enable:

```yaml
replication:
  replSetName: rs0
```

Restart the Windows service from Administrator PowerShell with `Restart-Service MongoDB`, then initialize the replica set once:

```powershell
mongosh "mongodb://127.0.0.1:27017/admin" --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Set `DATABASE_URL=mongodb://127.0.0.1:27017/lifepilot` in `backend/.env`; never put it in the frontend. From the repository root:

```powershell
npm run db:generate
npm run db:push
npm run db:health
npm run db:record-test
```

The connection-record test inserts a unique document into `database_connection_checks`, retrieves it, and leaves it for MongoDB Compass inspection. It does not update or delete existing data.
