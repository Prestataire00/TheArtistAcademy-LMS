// Endpoint healthcheck minimal pour Railway. 200 garanti, pas de middleware
// ni de dependance page/layout. Utilise par le probe Railway (railway.json).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
