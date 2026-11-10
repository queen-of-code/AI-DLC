#!/usr/bin/env node
// Validate every daemon GraphQL operation against Linear's public schema.
// Dev-only (needs the `graphql` package, resolved from the current directory):
//
//   curl -sSo schema.graphql https://raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql
//   npm i graphql@16
//   node <path>/daemon/test/check-schema.mjs schema.graphql
//
// The in-memory mock used by the unit tests dispatches on operation names and does not validate
// queries; this script is what proves the field names and argument types match the real API.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { OPS } from '../lib/linear.mjs';

const schemaFile = process.argv[2];
if (!schemaFile) {
  console.error('usage: check-schema.mjs <schema.graphql>');
  process.exit(2);
}
const require = createRequire(path.join(process.cwd(), 'noop.js'));
const { buildSchema, parse, validate } = require('graphql');
const schema = buildSchema(fs.readFileSync(schemaFile, 'utf8'), { assumeValidSDL: true });
let bad = 0;
for (const [name, query] of Object.entries(OPS)) {
  const errors = validate(schema, parse(query));
  if (errors.length) {
    bad++;
    console.log(`FAIL ${name}`);
    for (const e of errors) console.log(`     ${e.message}`);
  } else {
    console.log(`ok   ${name}`);
  }
}
console.log(bad ? `${bad} operation(s) invalid` : `all ${Object.keys(OPS).length} operations valid`);
process.exit(bad ? 1 : 0);
