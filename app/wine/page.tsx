import { redirect } from 'next/navigation';

export default function WineIndexPage() {
  redirect('/wine/list');
}
