// A single locked JSONB row keeps account, credential, session and governance
// changes atomic in this MVP. Split into normalized tables when volume grows.
export class PostgresStore{
  constructor(pool){this.pool=pool;}
  async init(){await this.pool.query('CREATE TABLE IF NOT EXISTS epsilon_auth_state (id integer PRIMARY KEY CHECK (id=1), data jsonb NOT NULL)');await this.pool.query('INSERT INTO epsilon_auth_state(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING',[{}]);}
  async transaction(fn){const client=await this.pool.connect();try{await client.query('BEGIN');const {rows}=await client.query('SELECT data FROM epsilon_auth_state WHERE id=1 FOR UPDATE');const state=rows[0].data;const result=await fn(state);await client.query('UPDATE epsilon_auth_state SET data=$1 WHERE id=1',[state]);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async close(){await this.pool.end();}
}
export class MemoryStore{
  constructor(){this.state={};this.queue=Promise.resolve();}
  async init(){}
  transaction(fn){const work=this.queue.then(async()=>{const next=structuredClone(this.state),result=await fn(next);this.state=next;return result;});this.queue=work.catch(()=>{});return work;}
  async close(){}
}
