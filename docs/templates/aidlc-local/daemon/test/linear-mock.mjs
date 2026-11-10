// In-memory Linear GraphQL server for the daemon tests. It dispatches on operation name (the daemon
// names every operation) and implements just the semantics the daemon relies on — notably that
// every state change is recorded in issue history with the ACTOR of the key that made it.
// Query/field names are proven separately against Linear's real schema (test/check-schema.mjs).
import http from 'node:http';

export function createLinearMock({ now = () => Date.now() } = {}) {
  let seq = 0;
  let last = 0;
  const id = (p) => `${p}-${++seq}`;
  const ts = () => {
    last = Math.max(now(), last + 1);
    return new Date(last).toISOString();
  };

  const users = {};
  const keys = {};
  const team = { id: 'team-eng', key: 'ENG', states: [] };
  const labels = [];
  const issues = new Map();
  const history = [];
  const comments = [];
  const documents = [];
  const relations = [];
  const uploads = {};
  const calls = [];
  const revoked = [];
  let number = 0;

  const stateNames = [
    ['Triage', 'triage'],
    ['Not Started', 'backlog'],
    ['Plan', 'unstarted'],
    ['Design', 'started'],
    ['Build+Test', 'started'],
    ['Review', 'started'],
    ['In Staging', 'started'],
    ['Ship', 'started'],
    ['Done', 'completed'],
    ['Canceled', 'canceled'],
  ];
  stateNames.forEach(([name, type], i) => team.states.push({ id: `state-${name.replace(/\W/g, '').toLowerCase()}`, name, type, position: i }));
  const stateByName = (n) => {
    const s = team.states.find((x) => x.name === n);
    if (!s) throw new Error(`mock: no state ${n}`);
    return s;
  };
  const stateById = (i) => team.states.find((x) => x.id === i);

  const apps = {}; // clientId → { secret, userId, ccEnabled, scopes }
  const tokens = {}; // minted OAuth access token → userId

  function addUser(uid, name, key, { app = false } = {}) {
    users[uid] = { id: uid, name, app };
    if (key) keys[key] = uid;
    return users[uid];
  }
  /** An OAuth app installed with actor=app: its own app user; client credentials enabled. */
  function addApp({ clientId, secret, userId, name, clientCredentials = true }) {
    addUser(userId, name, null, { app: true });
    apps[clientId] = { secret, userId, ccEnabled: clientCredentials, scopes: '' };
  }
  const userFor = (auth) => {
    if (!auth) return null;
    const raw = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    return tokens[raw] || keys[raw] || null;
  };
  function addLabel(name) {
    const l = { id: id('label'), name, teamId: team.id };
    labels.push(l);
    return l;
  }

  function createIssue({ title, description = '', state = 'Triage', parentId = null, creatorId = null, stateId = null }) {
    number++;
    const i = {
      id: `issue-${number}`,
      identifier: `${team.key}-${number}`,
      number,
      title,
      description,
      stateId: stateId || stateByName(state).id,
      parentId,
      delegateId: null,
      assigneeId: null,
      creatorId,
      labelIds: new Set(),
      createdAt: ts(),
      updatedAt: null,
    };
    i.updatedAt = i.createdAt;
    issues.set(i.id, i);
    return i;
  }

  const find = (idOrIdent) => issues.get(idOrIdent) || [...issues.values()].find((i) => i.identifier === idOrIdent) || null;

  function setState(issue, stateId, actorId, botActor = null) {
    if (issue.stateId === stateId) return;
    history.push({ id: id('hist'), issueId: issue.id, createdAt: ts(), fromStateId: issue.stateId, toStateId: stateId, actorId, botActor });
    issue.stateId = stateId;
    issue.updatedAt = ts();
  }

  function addComment(issueId, body, userId, botActor = null) {
    const c = { id: id('comment'), issueId, body, userId, botActor, createdAt: ts(), updatedAt: null };
    c.updatedAt = c.createdAt;
    comments.push(c);
    return c;
  }

  function saveDocument(issueId, title, content) {
    let d = documents.find((x) => x.issueId === issueId && x.title === title);
    if (!d) {
      d = { id: id('doc'), issueId, title, content, updatedAt: ts() };
      documents.push(d);
    } else {
      d.content = content;
      d.updatedAt = ts();
    }
    return d;
  }

  const st = (sid) => {
    const s = stateById(sid);
    return { id: s.id, name: s.name, type: s.type };
  };
  const user = (uid) => (uid ? { ...users[uid] } : null);

  function full(i) {
    const kids = [...issues.values()].filter((c) => c.parentId === i.id);
    const parent = i.parentId ? issues.get(i.parentId) : null;
    return {
      id: i.id,
      identifier: i.identifier,
      title: i.title,
      description: i.description,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      url: `https://linear.app/mock/issue/${i.identifier}`,
      state: st(i.stateId),
      team: { id: team.id, key: team.key },
      project: null,
      parent: parent ? { id: parent.id, identifier: parent.identifier } : null,
      delegate: i.delegateId ? { id: i.delegateId } : null,
      assignee: i.assigneeId ? { id: i.assigneeId } : null,
      creator: i.creatorId ? { id: i.creatorId } : null,
      labels: { nodes: labels.filter((l) => i.labelIds.has(l.id)).map((l) => ({ id: l.id, name: l.name })) },
      children: { nodes: kids.map((c) => ({ id: c.id, identifier: c.identifier, title: c.title, description: c.description, createdAt: c.createdAt, state: st(c.stateId) })) },
      inverseRelations: {
        nodes: relations.filter((r) => r.relatedIssueId === i.id).map((r) => {
          const src = issues.get(r.issueId);
          return { id: r.id, type: r.type, issue: { id: src.id, identifier: src.identifier, state: st(src.stateId) } };
        }),
      },
      relations: { nodes: relations.filter((r) => r.issueId === i.id).map((r) => ({ id: r.id, type: r.type, relatedIssue: { id: r.relatedIssueId } })) },
      history: {
        nodes: history
          .filter((h) => h.issueId === i.id)
          .map((h) => ({ id: h.id, createdAt: h.createdAt, fromStateId: h.fromStateId, toStateId: h.toStateId, actor: user(h.actorId), botActor: h.botActor })),
      },
      comments: { nodes: comments.filter((c) => c.issueId === i.id).map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, user: user(c.userId), botActor: c.botActor })) },
      documents: { nodes: documents.filter((d) => d.issueId === i.id).map((d) => ({ id: d.id, title: d.title, content: d.content, updatedAt: d.updatedAt })) },
    };
  }

  const conn = (nodes) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
  const gt = (a, b) => Date.parse(a) > Date.parse(b);

  const resolvers = {
    AidlcViewer: (_, uid) => ({ viewer: user(uid) }),
    AidlcTeam: (v) => ({ teams: { nodes: v.key === team.key ? [{ id: team.id, key: team.key, states: { nodes: team.states.map((s) => ({ ...s })) } }] : [] } }),
    AidlcLabel: (v) => ({ issueLabels: { nodes: labels.filter((l) => l.name === v.name).map((l) => ({ id: l.id, name: l.name, team: { id: l.teamId } })) } }),
    AidlcChanged: (v) => ({ issues: conn([...issues.values()].filter((i) => gt(i.updatedAt, v.since)).map((i) => ({ id: i.id, identifier: i.identifier, updatedAt: i.updatedAt }))) }),
    AidlcChangedComments: (v) => ({
      comments: conn(comments.filter((c) => gt(c.createdAt, v.since)).map((c) => ({ id: c.id, createdAt: c.createdAt, issue: { id: c.issueId, identifier: issues.get(c.issueId).identifier } }))),
    }),
    AidlcInStates: (v) => ({ issues: conn([...issues.values()].filter((i) => v.states.includes(stateById(i.stateId).name)).map((i) => ({ id: i.id, identifier: i.identifier, updatedAt: i.updatedAt }))) }),
    AidlcDelegated: (v) => ({ issues: { nodes: [...issues.values()].filter((i) => i.delegateId === v.bot).map((i) => ({ id: i.id, identifier: i.identifier })) } }),
    AidlcIssue: (v) => {
      const i = find(v.id);
      return { issue: i ? full(i) : null };
    },
    AidlcIssueUpdate: (v, uid) => {
      const i = find(v.id);
      if (!i) throw new Error(`Entity not found: ${v.id}`);
      const inp = v.input;
      if ('stateId' in inp) setState(i, inp.stateId, uid);
      if ('delegateId' in inp) {
        if (inp.delegateId !== null) {
          // Real Linear (verified 2026-11-09): "delegateId must correspond to an app user".
          if (!users[inp.delegateId]?.app) throw new Error('delegateId must correspond to an app user');
          const app = Object.values(apps).find((a) => a.userId === inp.delegateId);
          if (!app?.scopes.split(',').includes('app:assignable')) throw new Error('app is not assignable (app:assignable scope)');
        }
        i.delegateId = inp.delegateId;
      }
      if ('assigneeId' in inp) i.assigneeId = inp.assigneeId;
      i.updatedAt = ts();
      return { issueUpdate: { success: true, issue: { id: i.id, state: { id: i.stateId, name: stateById(i.stateId).name }, delegate: i.delegateId ? { id: i.delegateId } : null, assignee: i.assigneeId ? { id: i.assigneeId } : null } } };
    },
    AidlcIssueCreate: (v, uid) => {
      const i = createIssue({ title: v.input.title, description: v.input.description, stateId: v.input.stateId, parentId: v.input.parentId, creatorId: uid });
      return { issueCreate: { success: true, issue: { id: i.id, identifier: i.identifier } } };
    },
    AidlcRelationCreate: (v) => {
      relations.push({ id: id('rel'), type: v.input.type, issueId: v.input.issueId, relatedIssueId: v.input.relatedIssueId });
      return { issueRelationCreate: { success: true } };
    },
    AidlcCommentCreate: (v, uid) => ({ commentCreate: { success: true, comment: { id: addComment(find(v.input.issueId).id, v.input.body, uid).id } } }),
    AidlcCommentUpdate: (v) => {
      const c = comments.find((x) => x.id === v.id);
      if (!c) throw new Error(`Entity not found: ${v.id}`);
      c.body = v.input.body;
      c.updatedAt = ts();
      return { commentUpdate: { success: true, comment: { id: c.id } } };
    },
    AidlcAddLabel: (v) => {
      find(v.id).labelIds.add(v.labelId);
      return { issueAddLabel: { success: true } };
    },
    AidlcRemoveLabel: (v) => {
      find(v.id).labelIds.delete(v.labelId);
      return { issueRemoveLabel: { success: true } };
    },
    AidlcFileUpload: (v) => {
      const u = id('upload');
      uploads[u] = { filename: v.filename, contentType: v.contentType, size: v.size, bytes: null };
      return { fileUpload: { success: true, uploadFile: { uploadUrl: `${server.url}/upload/${u}`, assetUrl: `https://uploads.linear.app/mock/${u}/${v.filename}`, headers: [{ key: 'x-mock-signature', value: u }] } } };
    },
    // Test-only: what the agent's Linear MCP `save_document` would do.
    TestSaveDocument: (v) => ({ saved: saveDocument(find(v.issue).id, v.title, v.content).id }),
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST' && req.url === '/oauth/token') {
        const f = Object.fromEntries(new URLSearchParams(body.toString('utf8')));
        const app = apps[f.client_id];
        if (!app || app.secret !== f.client_secret) {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: 'invalid_client' }));
        }
        if (f.grant_type !== 'client_credentials' || !app.ccEnabled) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'unsupported_grant_type', error_description: 'Client does not support the client_credentials grant type' }));
        }
        const t = `lin_oauth_mock${++seq}${Math.floor(Math.random() * 1e9)}`;
        tokens[t] = app.userId;
        app.scopes = f.scope || 'read';
        return res.end(JSON.stringify({ access_token: t, token_type: 'Bearer', expires_in: 2591999, scope: app.scopes }));
      }
      if (req.method === 'POST' && req.url === '/oauth/revoke') {
        const f = Object.fromEntries(new URLSearchParams(body.toString('utf8')));
        if (!tokens[f.token]) {
          res.statusCode = 400;
          return res.end('{}');
        }
        delete tokens[f.token];
        revoked.push(f.token);
        return res.end('{}');
      }
      if (req.method === 'PUT' && req.url.startsWith('/upload/')) {
        const u = req.url.split('/')[2];
        if (!uploads[u] || req.headers['x-mock-signature'] !== u) {
          res.statusCode = 403;
          return res.end('{}');
        }
        uploads[u].bytes = body;
        return res.end('{}');
      }
      const uid = userFor(req.headers.authorization);
      if (!uid) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ errors: [{ message: 'Authentication required' }] }));
      }
      let parsed;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ errors: [{ message: 'bad JSON' }] }));
      }
      const op = parsed.operationName || (parsed.query.match(/^\s*(?:query|mutation)\s+(\w+)/) || [])[1];
      calls.push({ op, uid, variables: parsed.variables });
      const fn = resolvers[op];
      if (!fn) return res.end(JSON.stringify({ errors: [{ message: `mock: unsupported operation ${op}` }] }));
      try {
        res.end(JSON.stringify({ data: fn(parsed.variables || {}, uid) }));
      } catch (e) {
        res.end(JSON.stringify({ errors: [{ message: e.message }] }));
      }
    });
  });

  return {
    server,
    async start() {
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      server.url = `http://127.0.0.1:${server.address().port}`;
      this.url = `${server.url}/graphql`;
      return this;
    },
    stop: () => new Promise((r) => server.close(r)),
    team,
    users,
    labels,
    issues,
    history,
    comments,
    documents,
    relations,
    uploads,
    calls,
    addUser,
    addApp,
    tokens,
    revoked,
    addLabel,
    createIssue,
    find,
    stateByName,
    stateById,
    saveDocument,
    addComment,
    /** A move as made by `userId` (a human in the UI, or an agent misusing the bot key). */
    move(ident, stateName, userId, botActor = null) {
      setState(find(ident), stateByName(stateName).id, userId, botActor);
    },
    stateOf: (ident) => stateById(find(ident).stateId).name,
    labelsOf: (ident) => labels.filter((l) => find(ident).labelIds.has(l.id)).map((l) => l.name),
    commentsOn: (ident) => comments.filter((c) => c.issueId === find(ident).id),
    childrenOf: (ident) => [...issues.values()].filter((c) => c.parentId === find(ident).id).sort((a, b) => a.number - b.number),
  };
}
