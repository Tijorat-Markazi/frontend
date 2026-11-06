#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE_REF:?IMAGE_REF is required}"
suffix="${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
name="frontend-smoke-$suffix"
fixture="frontend-backend-fixture-$suffix"
network="frontend-smoke-$suffix"
cleanup() {
  docker rm -f "$name" "$fixture" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# No production credentials or VPS access. Unique disposable runner resources.
docker network create "$network" >/dev/null
docker run -d --name "$name" --network "$network" --read-only \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m -p 127.0.0.1::8080 "$IMAGE_REF" >/dev/null
ready=false
for ((attempt=1; attempt<=30; attempt++)); do
  if docker exec "$name" wget -q -O /dev/null http://127.0.0.1:8080/healthz; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { docker logs "$name"; exit 1; }
test "$(docker exec "$name" id -u)" = 101
# The frontend must be healthy BEFORE its backend exists (lazy Docker DNS).
node_image="$(awk '/^FROM node:/{print $2; exit}' Dockerfile)"
[[ "$node_image" =~ ^node:.*@sha256:[a-f0-9]{64}$ ]] || exit 1
docker run -d --name "$fixture" --network "$network" \
  --network-alias tijoratmarkazi-backend-upstream --read-only \
  --cap-drop=ALL --security-opt=no-new-privileges --user 1000:1000 \
  "$node_image" node --input-type=module -e "$(cat .github/scripts/proxy-fixture.mjs)" >/dev/null
ready=false
for ((attempt=1; attempt<=20; attempt++)); do
  if docker exec "$fixture" node -e 'fetch("http://127.0.0.1:4321/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || exit 1
port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$name")"
[[ "$port" =~ ^[0-9]+$ ]] || exit 1
export FRONTEND_SMOKE_ORIGIN="http://127.0.0.1:$port"
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base=process.env.FRONTEND_SMOKE_ORIGIN;
for(const target of ['/api','/api/probe?x=1','/ws','/uploads/private.txt']){
  const r=await fetch(base+target,{headers:{'X-Real-IP':'203.0.113.24','X-Forwarded-For':'1.1.1.1','X-Forwarded-Proto':'http','CF-Connecting-IP':'1.1.1.1',Cookie:'session=fixture'},signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200);
  const json=await r.json();
  assert.equal(json.url,target);
  assert.equal(json.headers['x-real-ip'],'203.0.113.24');
  assert.equal(json.headers['x-forwarded-for'],'203.0.113.24');
  assert.equal(json.headers['x-forwarded-proto'],'https');
  assert.equal(json.headers['cf-connecting-ip'],undefined);
  assert.equal(json.headers.cookie,'session=fixture');
}
for(const target of ['/.env','/missing-page','/apiary']) assert.equal((await fetch(base+target)).status,404);
assert.equal((await fetch(base+'/')).status,200);
await new Promise((resolve,reject)=>{
  const ws=new WebSocket(base.replace('http:','ws:')+'/ws/test');
  const timer=setTimeout(()=>{ws.close();reject(Error('WebSocket upgrade timeout'));},5000);
  ws.onopen=()=>{clearTimeout(timer);ws.close();resolve();};
  ws.onerror=()=>{clearTimeout(timer);reject(Error('WebSocket upgrade failed'));};
});
const error=await fetch(base+'/api/force-error?t=private-query-token&token=private-reset-token',{headers:{Referer:'https://example.test/private?private-referer-token'}});
assert.equal(error.status,502);
JS
logs="$(docker logs "$name" 2>&1)"
for token in private-query-token private-reset-token private-referer-token; do
  if grep -Fq "$token" <<< "$logs"; then echo 'Proxy logs exposed a query/Referer token.' >&2; exit 1; fi
done
echo 'Published frontend: non-root/read-only startup, independent health, same-origin paths, headers, cookies, WebSocket upgrades and log privacy passed.'
