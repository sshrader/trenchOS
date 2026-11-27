// Small helpers shared by the browser-side app windows.
export async function post(url, body, code) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': code },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error([data.error || 'Request failed.', data.detail].filter(Boolean).join(' '));
  return data;
}

export const f1 = (n) => (n == null ? 'n/a' : n.toFixed(1));
