const AUTH_VERIFICATION_STATUS_REWRITES = Object.freeze([
  ["SET status = 'superseded'", "SET status = 'expired'"],
  ["SET status = 'consumed', confirmed_at = COALESCE(confirmed_at, ?)", "SET status = 'blocked', confirmed_at = COALESCE(confirmed_at, ?)"],
]);

function rewriteAuthVerificationSql(sql = '') {
  let next = String(sql || '');
  for (const [source, replacement] of AUTH_VERIFICATION_STATUS_REWRITES) {
    next = next.replace(source, replacement);
  }
  return next;
}

function compatibleDb(db) {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') {
        return (sql) => target.prepare(rewriteAuthVerificationSql(sql));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function withCompatibleAuthVerificationStorage(env = {}) {
  if (!env?.DB?.prepare) return env;
  return {
    ...env,
    DB: compatibleDb(env.DB),
  };
}
