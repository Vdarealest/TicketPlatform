import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

// Boots the real app against a real, migrated Postgres + Redis.
//
// These tests write users, events and reservations, so they refuse to run
// against anything that isn't obviously a throwaway test database.
function assertTestDatabase() {
  const url = process.env.DATABASE_URL;
  const name = url ? new URL(url).pathname.slice(1) : process.env.DB_NAME;
  if (!name || !/test/i.test(name)) {
    throw new Error(
      `Refusing to run e2e tests against database "${name}". ` +
        'Point DB_NAME (or DATABASE_URL) at a database whose name contains "test".',
    );
  }
}

describe('Vietix API (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  const api = () => request(app.getHttpServer());

  const email = `e2e-${Date.now()}@example.com`;
  const password = 'secret123';
  let token: string;
  let ticketId: number;
  let seatIds: number[];

  beforeAll(async () => {
    assertTestDatabase();
    // Imported only after the guard: loading AppModule opens the DB pool.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);

    // A sellable event with one seated ticket type and three seats.
    const [event] = await db.query(
      `INSERT INTO event (title, description, location, "bannerUrl", "startTime", "endTime", status)
       VALUES ('E2E Show', 'desc', 'Hà Nội', 'https://example.com/b.jpg', now() + interval '7 days', now() + interval '8 days', 'ON_SALE')
       RETURNING id`,
    );
    const [ticket] = await db.query(
      `INSERT INTO ticket (type, price, quantity, seating, "eventId") VALUES ('VIP', 500000, 3, 'SEATED', $1) RETURNING id`,
      [event.id],
    );
    ticketId = ticket.id;
    const seats = await db.query(
      `INSERT INTO seat ("row", col, label, "ticketId") VALUES (1,1,'A1',$1),(1,2,'A2',$1),(1,3,'A3',$1) RETURNING id`,
      [ticketId],
    );
    seatIds = seats.map((s: { id: number }) => s.id);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('sends security headers', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  describe('auth', () => {
    it('registers, logs in and reads /auth/me', async () => {
      await api().post('/auth/register').send({ email, password }).expect(201);
      const login = await api().post('/auth/login').send({ email, password }).expect(201);
      token = login.body.access_token;
      expect(token).toBeTruthy();

      const me = await api().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body).toMatchObject({ email, role: 'USER' });
      expect(me.body).not.toHaveProperty('password');
    });

    it('rejects a duplicate email', async () => {
      await api().post('/auth/register').send({ email, password }).expect(400);
    });

    it('rejects a wrong password with 401', async () => {
      await api().post('/auth/login').send({ email, password: 'wrong-pass' }).expect(401);
    });

    it('validates the payload (bad email, short password, unknown fields)', async () => {
      await api().post('/auth/register').send({ email: 'nope', password }).expect(400);
      await api().post('/auth/register').send({ email: `x${email}`, password: '123' }).expect(400);
      // Mass-assignment guard: a client must not be able to set its own role.
      await api().post('/auth/register').send({ email: `y${email}`, password, role: 'ADMIN' }).expect(400);
    });

    it('rejects /auth/me without a token', async () => {
      await api().get('/auth/me').expect(401);
    });
  });

  describe('admin guard', () => {
    it('blocks anonymous and normal users', async () => {
      await api().get('/admin/dashboard').expect(401);
      await api().get('/admin/dashboard').set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('lets an ADMIN in', async () => {
      await db.query(`UPDATE "user" SET role = 'ADMIN' WHERE email = $1`, [email]);
      await api().get('/admin/dashboard').set('Authorization', `Bearer ${token}`).expect(200);
      await db.query(`UPDATE "user" SET role = 'USER' WHERE email = $1`, [email]);
    });
  });

  describe('catalogue', () => {
    it('lists the on-sale event', async () => {
      const res = await api().get('/events').expect(200);
      expect(res.body.map((e: { title: string }) => e.title)).toContain('E2E Show');
    });

    it('reports VietQR as disabled by default', async () => {
      const res = await api().get('/payments/methods').expect(200);
      expect(res.body).toEqual({ vietqr: process.env.VIETQR_MANUAL_CONFIRM === 'true' });
    });
  });

  describe('seat holds', () => {
    let guestToken: string;
    let heldIds: number[];

    it('lets a guest hold two seats', async () => {
      const res = await api()
        .post(`/reservations/${ticketId}/bulk`)
        .send({ seatIds: seatIds.slice(0, 2), guestEmail: 'guest@example.com' })
        .expect(201);
      guestToken = res.body.guestToken;
      heldIds = res.body.reservationIds;
      expect(heldIds).toHaveLength(2);

      const [row] = await db.query(`SELECT quantity FROM ticket WHERE id = $1`, [ticketId]);
      expect(row.quantity).toBe(1);
    });

    it('refuses a seat that is already held', async () => {
      await api()
        .post(`/reservations/${ticketId}/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ seatIds: [seatIds[1], seatIds[2]] })
        .expect(400);
      // The failed request rolled back: the free seat A3 is still free.
      const [seat] = await db.query(`SELECT status FROM seat WHERE id = $1`, [seatIds[2]]);
      expect(seat.status).toBe('AVAILABLE');
    });

    it('only shows the hold to whoever has the guest token', async () => {
      await api().post('/reservations/bulk/details').send({ ids: heldIds, guestToken: 'wrong' }).expect(403);
      const res = await api().post('/reservations/bulk/details').send({ ids: heldIds, guestToken }).expect(201);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).not.toHaveProperty('guestToken');
    });

    it('cancelling releases the seats and restocks', async () => {
      await api().post('/reservations/bulk/cancel').send({ ids: heldIds, guestToken }).expect(201);
      const seats = await db.query(`SELECT status FROM seat WHERE "ticketId" = $1`, [ticketId]);
      expect(seats.every((s: { status: string }) => s.status === 'AVAILABLE')).toBe(true);
      const [row] = await db.query(`SELECT quantity FROM ticket WHERE id = $1`, [ticketId]);
      expect(row.quantity).toBe(3);
    });

    it('two buyers racing for the same seat: exactly one wins', async () => {
      const attempt = (who: string) =>
        api().post(`/reservations/${ticketId}/bulk`).send({ seatIds: [seatIds[0]], guestEmail: `${who}@example.com` });
      const results = await Promise.all([attempt('a'), attempt('b'), attempt('c')]);
      const codes = results.map((r) => r.status).sort();
      expect(codes).toEqual([201, 400, 400]);
    });
  });
});
