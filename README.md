# Rescate de San Carlos 

## Database setup

Requires Docker Desktop (running)
1. Copy the env file and set a dev password:

   ```bash
   cp .env.example .env
   ```

2. Start MySQL 8.4 (first start takes ~20 seconds):

   ```bash
   docker compose up -d
   docker compose ps
   ```

   Wait until `db` shows `healthy`.

3. Create the tables (run the migration in `apps/api/migrations/`):

   ```bash
   docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < apps/api/migrations/0001_init.sql
   ```

4. Load the sample data (run the seeds in `apps/api/seeds/`, after the migration):

   ```bash
   docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < apps/api/seeds/001_prototype_seed.sql
   ```

   No output means success. To run every seed file in order:

   ```bash
   for f in apps/api/seeds/*.sql; do docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < "$f"; done
   ```

5. Open a MySQL prompt and check:

   ```bash
   docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate'
   ```

   Try `SHOW DATABASES;` (`rescate` should be in the list), then `SELECT * FROM patients;`. Type `exit` to leave.

### Notes

- Data lives in the `db_data` Docker volume and survives `docker compose down`.
- To wipe everything and start fresh:

  ```bash
  docker compose down -v
  docker compose up -d
  ```

- Stop the database without deleting data:

  ```bash
  docker compose down
  ```

- If `.env` changes after the first start, the password inside the database won't update. Wipe with `down -v` first.

run `npm install` in apps/api and (eventually) apps/web to install necessary dependencies
