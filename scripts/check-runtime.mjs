import request from 'supertest';

// Match Vercel's module restrictions and use test-only configuration.
process.env.VERCEL = '1';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-test-key';

const { default: handler } = await import('../dist/main.js');
await request(handler).get('/api').expect(200).expect('Hello World!');
await request(handler).get('/api/docs/').expect(200);
await request(handler).get('/api/me/books').expect(401);
await request(handler).get('/api/catalog').expect(401);
await request(handler).get('/api/me/wishlist').expect(401);
console.log('Compiled ESM handler works with require(ESM) disabled.');
