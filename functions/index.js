// The public root must be served from the current Vite build.
// Do not embed or return a legacy landing document here: doing so causes the
// old landing to paint before the current React home boots.
export async function onRequest(context) {
  return context.next();
}
