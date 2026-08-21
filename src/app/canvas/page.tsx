import { redirect } from 'next/navigation';

/** Canvas is one of four sources now, so the page it had became /import. */
export default function CanvasRedirect() {
  redirect('/import');
}
