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

    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');

    const { configureApp } =
      require('../src/app.setup') as typeof import('../src/app.setup');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
      const login = await api()
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      token = login.body.access_token;
      expect(token).toBeTruthy();

      const me = await api()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(me.body).toMatchObject({ email, role: 'USER' });
      expect(me.body).not.toHaveProperty('password');
    });

    it('rejects a duplicate email', async () => {
      await api().post('/auth/register').send({ email, password }).expect(400);
    });

    it('rejects a wrong password with 401', async () => {
      await api()
        .post('/auth/login')
        .send({ email, password: 'wrong-pass' })
        .expect(401);
    });

    it('validates the payload (bad email, short password, unknown fields)', async () => {
      await api()
        .post('/auth/register')
        .send({ email: 'nope', password })
        .expect(400);
      await api()
        .post('/auth/register')
        .send({ email: `x${email}`, password: '123' })
        .expect(400);
      // Mass-assignment guard: a client must not be able to set its own role.
      await api()
        .post('/auth/register')
        .send({ email: `y${email}`, password, role: 'ADMIN' })
        .expect(400);
    });

    it('rejects /auth/me without a token', async () => {
      await api().get('/auth/me').expect(401);
    });

    it('refresh rotates the token pair and logout ends the session (real Redis)', async () => {
      const login = await api()
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      const first = login.body.refresh_token as string;
      expect(first).toBeTruthy();

      const r1 = await api()
        .post('/auth/refresh')
        .send({ refresh_token: first })
        .expect(201);
      expect(r1.body.access_token).toBeTruthy();
      await api()
        .get('/auth/me')
        .set('Authorization', `Bearer ${r1.body.access_token}`)
        .expect(200);
      // Old token is spent.
      await api()
        .post('/auth/refresh')
        .send({ refresh_token: first })
        .expect(401);

      await api()
        .post('/auth/logout')
        .send({ refresh_token: r1.body.refresh_token })
        .expect(201);
      await api()
        .post('/auth/refresh')
        .send({ refresh_token: r1.body.refresh_token })
        .expect(401);
      // Payload validation: the field is required.
      await api().post('/auth/refresh').send({}).expect(400);
    });

    it('Google sign-in code is single-use, stored in real Redis', async () => {
      const { AuthService } =
        require('../src/auth/auth.service') as typeof import('../src/auth/auth.service');
      const code = await app.get(AuthService).createOAuthCode({
        access_token: 'jwt-from-google',
        refresh_token: 'r',
      });
      const first = await api()
        .post('/auth/oauth/exchange')
        .send({ code })
        .expect(201);
      expect(first.body.access_token).toBe('jwt-from-google');
      await api().post('/auth/oauth/exchange').send({ code }).expect(400);
    });
  });

  describe('admin guard', () => {
    it('blocks anonymous and normal users', async () => {
      await api().get('/admin/dashboard').expect(401);
      await api()
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an ADMIN in', async () => {
      await db.query(`UPDATE "user" SET role = 'ADMIN' WHERE email = $1`, [
        email,
      ]);
      await api()
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await db.query(`UPDATE "user" SET role = 'USER' WHERE email = $1`, [
        email,
      ]);
    });
  });

  describe('catalogue', () => {
    it('lists the on-sale event', async () => {
      const res = await api().get('/events').expect(200);
      expect(res.body.map((e: { title: string }) => e.title)).toContain(
        'E2E Show',
      );
    });

    it('reports VietQR as disabled by default', async () => {
      const res = await api().get('/payments/methods').expect(200);
      expect(res.body).toEqual({
        vietqr: process.env.VIETQR_MANUAL_CONFIRM === 'true',
      });
    });
  });

  // Each payload below is built the way the frontend builds it (same keys,
  // same null / "" values). forbidNonWhitelisted turns any key a DTO forgot
  // into a 400, so this is what keeps the DTOs and the UI in step.
  describe('DTOs accept what the frontend sends', () => {
    const auth = () => ({ Authorization: `Bearer ${token}` });
    let eventId: number;

    beforeAll(async () => {
      await db.query(`UPDATE "user" SET role = 'ADMIN' WHERE email = $1`, [
        email,
      ]);
    });
    afterAll(async () => {
      await db.query(`UPDATE "user" SET role = 'USER' WHERE email = $1`, [
        email,
      ]);
    });

    it('admin: create event (admin/events/page.tsx handleSubmit)', async () => {
      const res = await api()
        .post('/admin/events')
        .set(auth())
        .send({
          title: 'DTO Show',
          description: '',
          location: 'HCM',
          category: 'Âm nhạc',
          bannerUrl: '',
          bannerFocusX: 50,
          bannerFocusY: 50,
          startTime: new Date(Date.now() + 86_400_000).toISOString(),
          endTime: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          venueId: null,
          featured: false,
          featuredOrder: 0,
          status: 'ON_SALE',
          saleOpenAt: null,
          tickets: [
            {
              type: 'Standard',
              price: 300000,
              quantity: 20,
              seating: 'SEATED',
            },
            { type: 'GA', price: 200000, quantity: 50, seating: 'GENERAL' },
          ],
        })
        .expect(201);
      eventId = res.body.id;
      expect(res.body.tickets).toHaveLength(2);
    });

    it('admin: toggle featured, edit a tier, add a tier', async () => {
      await api()
        .put(`/admin/events/${eventId}`)
        .set(auth())
        .send({ featured: true })
        .expect(200);
      const ev = await api()
        .get(`/admin/events/${eventId}`)
        .set(auth())
        .expect(200);
      const tier = ev.body.tickets.find(
        (t: { type: string }) => t.type === 'Standard',
      );
      await api()
        .put(`/admin/tickets/${tier.id}`)
        .set(auth())
        .send({ price: 350000, quantity: 25 })
        .expect(200);
      await api()
        .post(`/admin/events/${eventId}/tickets`)
        .set(auth())
        .send({ type: 'VIP', price: 900000, quantity: 10, seating: 'SEATED' })
        .expect(201);
    });

    it('admin: rejects unknown fields and bad types', async () => {
      await api()
        .put(`/admin/events/${eventId}`)
        .set(auth())
        .send({ featured: true, hacked: 1 })
        .expect(400);
      await api()
        .post(`/admin/events/${eventId}/tickets`)
        .set(auth())
        .send({ type: 'X', price: '100', quantity: 1 })
        .expect(400);
      await api()
        .post('/admin/events')
        .set(auth())
        .send({ title: 'missing the rest' })
        .expect(400);
    });

    it('admin: venues (admin/venues/page.tsx)', async () => {
      const v = await api()
        .post('/admin/venues')
        .set(auth())
        .send({ name: 'Hall', address: undefined, capacity: 500 })
        .expect(201);
      await api()
        .put(`/admin/venues/${v.body.id}`)
        .set(auth())
        .send({ name: 'Hall 2', capacity: undefined })
        .expect(200);
    });

    it('admin: users (admin/users/page.tsx)', async () => {
      const u = await api()
        .post('/admin/users')
        .set(auth())
        .send({
          email: `admin2-${email}`,
          password: 'secret123',
          phone: undefined,
          role: 'ADMIN',
          adminPassword: password,
        })
        .expect(201);
      await api()
        .put(`/admin/users/${u.body.id}`)
        .set(auth())
        .send({ phone: '0900000001', adminPassword: password })
        .expect(200);
      await api()
        .put(`/admin/users/${u.body.id}`)
        .set(auth())
        .send({ role: 'OWNER', adminPassword: password })
        .expect(400);
      await api()
        .delete(`/admin/users/${u.body.id}`)
        .set(auth())
        .send({ adminPassword: password })
        .expect(200);
    });

    it('profile: update and change password (profile/page.tsx)', async () => {
      await api()
        .patch('/users/profile')
        .set(auth())
        .send({ name: 'E2E', phone: '', avatarUrl: '' })
        .expect(200);
      // Mass assignment: a user must not be able to promote themselves.
      await api()
        .patch('/users/profile')
        .set(auth())
        .send({ name: 'E2E', role: 'ADMIN' })
        .expect(400);
      await api()
        .patch('/users/change-password')
        .set(auth())
        .send({ currentPassword: password, newPassword: password })
        .expect(200);
    });

    it('reviews (events/[id]/page.tsx)', async () => {
      await api()
        .post(`/reviews/event/${eventId}`)
        .set(auth())
        .send({ rating: 6, comment: 'x' })
        .expect(400);
      // A valid body gets past the DTO to the business rule (event not over yet).
      const res = await api()
        .post(`/reviews/event/${eventId}`)
        .set(auth())
        .send({ rating: 5, comment: 'Tuyệt vời' })
        .expect(400);
      expect(res.body.message).toBe(
        'Chỉ có thể đánh giá sau khi sự kiện kết thúc.',
      );
    });

    it('contact form (contact/page.tsx)', async () => {
      await api()
        .post('/contact')
        .send({
          name: 'A',
          email: 'a@example.com',
          subject: 'Hi',
          message: 'Hello',
        })
        .expect(201);
      await api()
        .post('/contact')
        .send({
          name: 'A',
          email: 'not-an-email',
          subject: 'Hi',
          message: 'Hello',
        })
        .expect(400);
    });

    it('password reset (forgot-password/page.tsx)', async () => {
      await api()
        .post('/auth/forgot-password')
        .send({ identifier: 'nobody@example.com' })
        .expect(400);
      await api()
        .post('/auth/verify-otp')
        .send({ email, otp: '12' })
        .expect(400);
    });

    it('standing tickets + payment for a logged-in user (guestToken null)', async () => {
      const ev = await api()
        .get(`/admin/events/${eventId}`)
        .set(auth())
        .expect(200);
      const ga = ev.body.tickets.find(
        (t: { seating: string }) => t.seating === 'GENERAL',
      );
      const hold = await api()
        .post(`/reservations/${ga.id}/general`)
        .set(auth())
        .send({ quantity: 2 })
        .expect(201);
      const ids = hold.body.reservationIds;

      await api()
        .post('/reservations/bulk/details')
        .set(auth())
        .send({ ids, guestToken: null })
        .expect(201);
      const pay = await api()
        .post('/payments/vnpay/create-url')
        .set(auth())
        .send({ reservationIds: ids, guestToken: null })
        .expect(201);
      expect(pay.body.paymentUrl).toContain('vnp_Amount=40000000');
      await api()
        .post('/payments/momo/create-url')
        .set(auth())
        .send({ reservationIds: ids, requestType: 'bogus', guestToken: null })
        .expect(400);
      await api()
        .post('/reservations/bulk/cancel')
        .set(auth())
        .send({ ids, guestToken: null })
        .expect(201);
    });

    it('rejects more than 10 seats with the Vietnamese message', async () => {
      const res = await api()
        .post(`/reservations/${ticketId}/bulk`)
        .set(auth())
        .send({ seatIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain(
        'Chọn từ 1 đến 10 ghế.',
      );
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

      const [row] = await db.query(
        `SELECT quantity FROM ticket WHERE id = $1`,
        [ticketId],
      );
      expect(row.quantity).toBe(1);
    });

    it('refuses a seat that is already held', async () => {
      await api()
        .post(`/reservations/${ticketId}/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ seatIds: [seatIds[1], seatIds[2]] })
        .expect(400);
      // The failed request rolled back: the free seat A3 is still free.
      const [seat] = await db.query(`SELECT status FROM seat WHERE id = $1`, [
        seatIds[2],
      ]);
      expect(seat.status).toBe('AVAILABLE');
    });

    it('only shows the hold to whoever has the guest token', async () => {
      await api()
        .post('/reservations/bulk/details')
        .send({ ids: heldIds, guestToken: 'wrong' })
        .expect(403);
      const res = await api()
        .post('/reservations/bulk/details')
        .send({ ids: heldIds, guestToken })
        .expect(201);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).not.toHaveProperty('guestToken');
    });

    it('cancelling releases the seats and restocks', async () => {
      await api()
        .post('/reservations/bulk/cancel')
        .send({ ids: heldIds, guestToken })
        .expect(201);
      const seats = await db.query(
        `SELECT status FROM seat WHERE "ticketId" = $1`,
        [ticketId],
      );
      expect(
        seats.every((s: { status: string }) => s.status === 'AVAILABLE'),
      ).toBe(true);
      const [row] = await db.query(
        `SELECT quantity FROM ticket WHERE id = $1`,
        [ticketId],
      );
      expect(row.quantity).toBe(3);
    });

    it('two buyers racing for the same seat: exactly one wins', async () => {
      const attempt = (who: string) =>
        api()
          .post(`/reservations/${ticketId}/bulk`)
          .send({ seatIds: [seatIds[0]], guestEmail: `${who}@example.com` });
      const results = await Promise.all([
        attempt('a'),
        attempt('b'),
        attempt('c'),
      ]);
      const codes = results.map((r) => r.status).sort();
      expect(codes).toEqual([201, 400, 400]);
    });
  });
});
