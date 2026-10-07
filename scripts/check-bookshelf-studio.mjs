// Local PostgreSQL verification, with Supabase auth/storage scaffolding.
// npm install --prefix .tmp/sql-check --no-save --package-lock=false @electric-sql/pglite
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { migrateDesign, stableJson } from '../dist/library/bookshelf-design.js';
const require = createRequire(import.meta.url);
const {
  PGlite,
} = require('../.tmp/sql-check/node_modules/@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON storage.objects TO authenticated,service_role;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
  `);
  await db.exec(
    await readFile(
      new URL('../src/books/database/schema.sql', import.meta.url),
      'utf8',
    ),
  );
  const directory = new URL(
    '../src/books/database/migrations/',
    import.meta.url,
  );
  const legacyOwner = '55555555-5555-4555-8555-555555555555';
  let legacyBooks;
  let legacyOrder;
  let legacyPath;
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (name.startsWith('008')) {
      await db.query('INSERT INTO auth.users(id) VALUES ($1)', [legacyOwner]);
      const { rows } = await db.query(
        "INSERT INTO books(title,pages) SELECT 'Legacy migration '||n,240 FROM generate_series(1,3) n RETURNING id",
      );
      const ids = rows.map((row) => row.id);
      legacyOrder = [ids[2], ids[0], ids[1]];
      legacyPath = `${legacyOwner}/${ids[0]}/33333333-3333-4333-8333-333333333333.jpg`;
      await db.query(
        'INSERT INTO user_books(user_id,book_id) SELECT $1,unnest($2::integer[])',
        [legacyOwner, ids],
      );
      await db.query(
        "UPDATE user_books SET spine_width=54,spine_height=224,spine_color='#123456',spine_image_path=$1 WHERE user_id=$2 AND book_id=$3",
        [legacyPath, legacyOwner, ids[0]],
      );
      await db.query(
        'UPDATE user_books SET metadata=\'{"pages":600}\' WHERE user_id=$1 AND book_id=$2',
        [legacyOwner, ids[1]],
      );
      await db.query(
        'INSERT INTO user_bookshelf(user_id,book_ids,revision) VALUES($1,$2,7)',
        [legacyOwner, [ids[2], ids[0]]],
      );
      legacyBooks = legacyOrder.map((book_id) => ({
        book_id,
        book: { pages: book_id === ids[1] ? 600 : 240 },
        ...(book_id === ids[0] ? { spine: { width: 54, height: 224 } } : {}),
      }));
    }
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
    console.log(`Migration ${name}: OK`);
  }
  const { rows: migrated } = await db.query(
    'SELECT * FROM user_bookshelf WHERE user_id=$1',
    [legacyOwner],
  );
  assert.equal(migrated[0].revision, 7);
  assert.deepEqual(migrated[0].book_ids, legacyOrder);
  assert.equal(
    stableJson(migrated[0].design),
    stableJson(migrateDesign(legacyBooks)),
  );
  const { rows: photos } = await db.query(
    'SELECT spine_image_path FROM user_books WHERE user_id=$1 AND spine_image_path IS NOT NULL',
    [legacyOwner],
  );
  assert.equal(photos[0].spine_image_path, legacyPath);
  await db.query('DELETE FROM auth.users WHERE id=$1', [legacyOwner]);
  console.log(
    'Legacy migration: order, geometry, metadata, revision and private photo retained',
  );
  const testDirectory = new URL('../test/database/', import.meta.url);
  for (const name of (await readdir(testDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(
      await readFile(
        new URL(`../test/database/${name}`, import.meta.url),
        'utf8',
      ),
    );
    console.log(`Database test ${name}: OK`);
  }
  const owner = '33333333-3333-4333-8333-333333333333';
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${owner}');`);
  const { rows } = await db.query(
    "INSERT INTO books(title) SELECT 'Studio performance ' || i FROM generate_series(1,500) i RETURNING id",
  );
  const ids = rows.map((row) => row.id);
  await db.query(
    'INSERT INTO user_books(user_id,book_id) SELECT $1,unnest($2::integer[])',
    [owner, ids],
  );
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  await db.exec('SET ROLE authenticated');
  const scene = migrateDesign(ids.map((book_id) => ({ book_id })));
  const started = performance.now();
  await db.query(
    'SELECT public.save_bookshelf_design($1::integer[],0,$2::jsonb)',
    [ids, JSON.stringify(scene)],
  );
  console.log(
    `500-book transaction: OK (${Math.round(performance.now() - started)} ms)`,
  );
} catch (error) {
  console.error(
    'Database verification failed:',
    error.message,
    error.code ?? '',
    error.where ?? '',
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
