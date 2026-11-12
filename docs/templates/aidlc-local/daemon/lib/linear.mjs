// Linear GraphQL client for the daemon — the ONLY holder of the write credential (the AIDLC Daemon
// OAuth app's client credentials, or a static key in the legacy setup). The agent's own token is
// read + comments only (Decision B): the agent never gets write.
// Every operation is named; test/check-schema.mjs validates each one against Linear's public schema,
// and the test mock dispatches on the operation name.

export const OPS = {
  AidlcViewer: `query AidlcViewer { viewer { id name } }`,

  AidlcTeam: `query AidlcTeam($key: String!) {
    teams(filter: { key: { eq: $key } }) {
      nodes { id key states(first: 100) { nodes { id name type position } } }
    }
  }`,

  AidlcLabel: `query AidlcLabel($name: String!) {
    issueLabels(first: 10, filter: { name: { eq: $name } }) { nodes { id name team { id } } }
  }`,

  AidlcChanged: `query AidlcChanged($team: String!, $since: DateTimeOrDuration!, $after: String) {
    issues(first: 50, after: $after, orderBy: updatedAt,
      filter: { team: { key: { eq: $team } }, updatedAt: { gt: $since } }) {
      nodes { id identifier updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }`,

  AidlcChangedComments: `query AidlcChangedComments($team: String!, $since: DateTimeOrDuration!, $after: String) {
    comments(first: 100, after: $after,
      filter: { createdAt: { gt: $since }, issue: { team: { key: { eq: $team } } } }) {
      nodes { id createdAt issue { id identifier } }
      pageInfo { hasNextPage endCursor }
    }
  }`,

  AidlcInStates: `query AidlcInStates($team: String!, $states: [String!]!, $after: String) {
    issues(first: 100, after: $after,
      filter: { team: { key: { eq: $team } }, state: { name: { in: $states } } }) {
      nodes { id identifier updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }`,

  AidlcDelegated: `query AidlcDelegated($team: String!, $bot: ID!) {
    issues(first: 100, filter: { team: { key: { eq: $team } }, delegate: { id: { eq: $bot } } }) {
      nodes { id identifier }
    }
  }`,

  AidlcIssue: `query AidlcIssue($id: String!) {
    issue(id: $id) {
      id identifier title description createdAt updatedAt url
      state { id name type }
      team { id key }
      project { id }
      parent { id identifier }
      delegate { id }
      assignee { id }
      creator { id }
      labels(first: 50) { nodes { id name } }
      children(first: 50) { nodes { id identifier title description createdAt state { id name type } } }
      inverseRelations(first: 50) { nodes { id type issue { id identifier state { id name type } } } }
      relations(first: 50) { nodes { id type relatedIssue { id } } }
      history(first: 100) { nodes { id createdAt fromStateId toStateId actor { id name } botActor { type name } } }
      comments(first: 100) { nodes { id body createdAt user { id name } botActor { type } } }
      documents(first: 50) { nodes { id title content updatedAt } }
    }
  }`,

  AidlcIssueUpdate: `mutation AidlcIssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { id state { id name } delegate { id } assignee { id } }
    }
  }`,

  AidlcIssueCreate: `mutation AidlcIssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier } }
  }`,

  AidlcRelationCreate: `mutation AidlcRelationCreate($input: IssueRelationCreateInput!) {
    issueRelationCreate(input: $input) { success }
  }`,

  AidlcCommentCreate: `mutation AidlcCommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) { success comment { id } }
  }`,

  AidlcCommentUpdate: `mutation AidlcCommentUpdate($id: String!, $input: CommentUpdateInput!) {
    commentUpdate(id: $id, input: $input) { success comment { id } }
  }`,

  AidlcAddLabel: `mutation AidlcAddLabel($id: String!, $labelId: String!) {
    issueAddLabel(id: $id, labelId: $labelId) { success }
  }`,

  AidlcRemoveLabel: `mutation AidlcRemoveLabel($id: String!, $labelId: String!) {
    issueRemoveLabel(id: $id, labelId: $labelId) { success }
  }`,

  AidlcFileUpload: `mutation AidlcFileUpload($contentType: String!, $filename: String!, $size: Int!) {
    fileUpload(contentType: $contentType, filename: $filename, size: $size) {
      success
      uploadFile { uploadUrl assetUrl headers { key value } }
    }
  }`,

  AidlcDocumentCreate: `mutation AidlcDocumentCreate($input: DocumentCreateInput!) {
    documentCreate(input: $input) { success document { id title content } }
  }`,

  AidlcDocumentUpdate: `mutation AidlcDocumentUpdate($id: String!, $input: DocumentUpdateInput!) {
    documentUpdate(id: $id, input: $input) { success document { id title content } }
  }`,
};

import { authHeader } from './oauth.mjs';

const byTime = (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

export class Linear {
  /**
   * key: a static credential (personal API key or OAuth access token), or
   * tokens: a ClientCredentials minting actor=app tokens (re-minted once on a 401).
   */
  constructor({ apiUrl, key, tokens, fetchImpl = fetch }) {
    if (!key && !tokens) throw new Error('Linear client needs a key or OAuth client credentials');
    this.apiUrl = apiUrl;
    this.key = key;
    this.tokens = tokens;
    this.fetch = fetchImpl;
  }

  async auth(force = false) {
    return authHeader(this.tokens ? await this.tokens.token(force) : this.key);
  }

  async gql(op, variables = {}, retried = false) {
    const query = OPS[op];
    if (!query) throw new Error(`unknown Linear operation ${op}`);
    const res = await this.fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await this.auth(retried) },
      body: JSON.stringify({ query, variables, operationName: op }),
      signal: AbortSignal.timeout(30e3),
    });
    if (res.status === 401 && this.tokens && !retried) return this.gql(op, variables, true);
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Linear ${op}: HTTP ${res.status}, not JSON`);
    }
    if (body.errors?.length) throw new Error(`Linear ${op}: ${body.errors.map((e) => e.message).join('; ')}`);
    if (!res.ok) throw new Error(`Linear ${op}: HTTP ${res.status}`);
    return body.data;
  }

  async paged(op, variables, pick) {
    const out = [];
    let after = null;
    for (let i = 0; i < 20; i++) {
      const conn = pick(await this.gql(op, { ...variables, after }));
      out.push(...conn.nodes);
      if (!conn.pageInfo?.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return out;
  }

  async viewer() {
    return (await this.gql('AidlcViewer')).viewer;
  }

  async team(key) {
    const t = (await this.gql('AidlcTeam', { key })).teams.nodes[0];
    if (!t) throw new Error(`no Linear team with key ${key}`);
    return { id: t.id, key: t.key, states: t.states.nodes };
  }

  async labelId(name, teamId) {
    const nodes = (await this.gql('AidlcLabel', { name })).issueLabels.nodes;
    const hit = nodes.find((l) => l.team?.id === teamId) || nodes.find((l) => !l.team);
    return hit?.id || null;
  }

  changedIssues(team, since) {
    return this.paged('AidlcChanged', { team, since }, (d) => d.issues);
  }

  changedComments(team, since) {
    return this.paged('AidlcChangedComments', { team, since }, (d) => d.comments);
  }

  issuesInStates(team, states) {
    return this.paged('AidlcInStates', { team, states }, (d) => d.issues);
  }

  async delegatedTo(team, bot) {
    return (await this.gql('AidlcDelegated', { team, bot })).issues.nodes;
  }

  /** Full snapshot with connections flattened and history/comments sorted oldest → newest. */
  async issue(id) {
    const i = (await this.gql('AidlcIssue', { id })).issue;
    if (!i) return null;
    return {
      ...i,
      labels: i.labels.nodes,
      children: i.children.nodes,
      inverseRelations: i.inverseRelations.nodes,
      relations: i.relations.nodes,
      history: [...i.history.nodes].sort(byTime),
      comments: [...i.comments.nodes].sort(byTime),
      documents: i.documents.nodes,
    };
  }

  async updateIssue(id, input) {
    const r = (await this.gql('AidlcIssueUpdate', { id, input })).issueUpdate;
    if (!r.success) throw new Error(`issueUpdate ${id} failed`);
    return r.issue;
  }

  async createIssue(input) {
    const r = (await this.gql('AidlcIssueCreate', { input })).issueCreate;
    if (!r.success || !r.issue) throw new Error('issueCreate failed');
    return r.issue;
  }

  async relate(issueId, relatedIssueId, type = 'blocks') {
    await this.gql('AidlcRelationCreate', { input: { issueId, relatedIssueId, type } });
  }

  async comment(issueId, body) {
    return (await this.gql('AidlcCommentCreate', { input: { issueId, body } })).commentCreate.comment.id;
  }

  async editComment(id, body) {
    await this.gql('AidlcCommentUpdate', { id, input: { body } });
  }

  async addLabel(id, labelId) {
    await this.gql('AidlcAddLabel', { id, labelId });
  }

  async removeLabel(id, labelId) {
    await this.gql('AidlcRemoveLabel', { id, labelId });
  }

  /** Decision B: agents hold no Document write scope; the daemon publishes their files as Documents. */
  async documentCreate({ title, content, issueId }) {
    const r = (await this.gql('AidlcDocumentCreate', { input: { title, content, ...(issueId ? { issueId } : {}) } })).documentCreate;
    if (!r.success || !r.document) throw new Error('documentCreate failed');
    return r.document;
  }

  async documentUpdate(id, { title, content }) {
    const r = (await this.gql('AidlcDocumentUpdate', { id, input: { ...(title ? { title } : {}), ...(content !== undefined ? { content } : {}) } })).documentUpdate;
    if (!r.success || !r.document) throw new Error(`documentUpdate ${id} failed`);
    return r.document;
  }

  /** Upload bytes via Linear's signed-URL flow; returns the asset URL to link in a comment. */
  async upload(filename, contentType, bytes) {
    const r = (await this.gql('AidlcFileUpload', { contentType, filename, size: bytes.length })).fileUpload;
    if (!r.success || !r.uploadFile) throw new Error(`fileUpload ${filename} failed`);
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' };
    for (const h of r.uploadFile.headers) headers[h.key] = h.value;
    const put = await this.fetch(r.uploadFile.uploadUrl, { method: 'PUT', headers, body: bytes, signal: AbortSignal.timeout(120e3) });
    if (!put.ok) throw new Error(`upload PUT ${filename}: HTTP ${put.status}`);
    return r.uploadFile.assetUrl;
  }
}
