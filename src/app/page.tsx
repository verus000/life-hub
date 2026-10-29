import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { getSessionUser } from '@/server/auth/service';
import { SESSION_COOKIE } from '@/server/auth/constants';
import { listItems } from '@/server/items/service';
import { Dashboard } from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(getDb(), token);
  if (!user) redirect('/login');
  const items = await listItems(getDb(), user.id);
  return <Dashboard initialItems={items} email={user.email} />;
}
