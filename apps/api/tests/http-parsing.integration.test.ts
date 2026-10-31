import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";
const exec = promisify(execFile);
it("rejects compressed and trailing-byte bodies without crashing the isolated API process", async () => {
  const code = `
    import { createServer, request } from 'node:http';
    import { gzipSync } from 'node:zlib';
    import { compose } from './src/composition.ts';
    import { createApp } from './src/app.ts';
    const deps = compose({ NODE_ENV:'test', DATABASE_URL:'postgresql://hours:hours_test_only@localhost:54321/hours_test', BETTER_AUTH_SECRET:'synthetic-parser-test-secret-at-least-32-characters', BETTER_AUTH_URL:'http://localhost:3000', WEB_ORIGIN:'http://localhost:3000', LOG_LEVEL:'silent' });
    const server=createServer(createApp(deps));
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const port=server.address().port;
    function send(body) { return new Promise((resolve,reject)=>{
      const req=request({host:'127.0.0.1',port,path:'/api/v1/me',method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip','Content-Length':body.length,Origin:'http://localhost:3000'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject); req.end(body);
    }); }
    const gzip=gzipSync(Buffer.from('{}'));
    const statuses=[await send(gzip),await send(Buffer.concat([gzip,Buffer.from('invalid trailing bytes')]))];
    await new Promise(r=>setTimeout(r,100));
    const health=await fetch('http://127.0.0.1:'+port+'/api/health');
    statuses.push(health.status);
    await new Promise(r=>server.close(r)); await deps.pool.end();
    process.stdout.write(JSON.stringify(statuses));
  `;
  const result = await exec(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", code],
    { timeout: 15000, maxBuffer: 65536 },
  );
  expect(JSON.parse(result.stdout)).toEqual([415, 415, 200]);
});
