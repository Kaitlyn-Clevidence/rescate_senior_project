// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-16
// Last updated: 2026-11-16
// Purpose: data layer repository for attachment table; contains queries 
// to the attachment table and methods to interract with attachment

import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";