export async function pageroAccountStatus(db, ownerId = '') {
  const safeOwnerId = String(ownerId || '').trim();
  if (!db?.prepare || !safeOwnerId) {
    return {
      status: 'unknown',
      connected: false,
      projectCount: 0,
      message: '페이지로 계정 연결 여부를 확인하지 못했습니다.',
    };
  }

  try {
    const row = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM projects
      WHERE owner_account_id = ?
    `).bind(safeOwnerId).first();
    const projectCount = Math.max(0, Number(row?.count || 0));
    const connected = projectCount > 0;
    return {
      status: connected ? 'connected' : 'not_connected',
      connected,
      projectCount,
      message: connected
        ? '페이지로 계정이 확인되었습니다.'
        : '페이지로 계정이 확인되지 않았습니다. 콜태그는 계속 사용할 수 있으며 더보기 > 페이지로 연결에서 나중에 설정할 수 있습니다.',
    };
  } catch (error) {
    console.error('PageRo account status lookup failed', {
      ownerId: safeOwnerId,
      message: String(error?.message || error || ''),
    });
    return {
      status: 'unknown',
      connected: false,
      projectCount: 0,
      message: '페이지로 계정 연결 여부를 확인하지 못했습니다. 콜태그는 계속 사용할 수 있으며 더보기 > 페이지로 연결에서 나중에 확인할 수 있습니다.',
    };
  }
}
