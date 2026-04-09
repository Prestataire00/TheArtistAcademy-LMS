// Tests Phase 0 — SSO JWT Dendreo
// À compléter avec les cas de test définis dans le PRD (section 12.1)

describe('POST /api/v1/auth/sso', () => {
  it.todo('should create user and enrollment on valid JWT');
  it.todo('should reject expired JWT with 401');
  it.todo('should reject invalid signature with 401');
  it.todo('should reject replay attack (same jti) with 401');
  it.todo('should reject access before start_date');
  it.todo('should reject access after end_date');
  it.todo('should upsert user without creating duplicate');
  it.todo('should upsert enrollment without creating duplicate');
  it.todo('should log SSO event in EventLog');
  it.todo('should set httpOnly cookie with internal JWT');
});
