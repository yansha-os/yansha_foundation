const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const port = process.env.PORT || 4873;
const artifactsDir = path.resolve(__dirname, '..', 'release-artifacts');

function makePackageMetadata(pkgName, tgzName) {
  const tgzPath = path.join(artifactsDir, tgzName);
  if (!fs.existsSync(tgzPath)) {
    return null;
  }
  const data = fs.readFileSync(tgzPath);
  const shasum = crypto.createHash('sha1').update(data).digest('hex');
  const integrity = 'sha512-' + crypto.createHash('sha512').update(data).digest('base64');

  return {
    _id: pkgName,
    name: pkgName,
    'dist-tags': { latest: '0.1.0' },
    versions: {
      '0.1.0': {
        name: pkgName,
        version: '0.1.0',
        dist: {
          tarball: 'http://127.0.0.1:' + port + '/' + pkgName + '/-/' + tgzName,
          shasum: shasum,
          integrity: integrity
        }
      }
    }
  };
}

const packages = {
  '@yansha/ui': makePackageMetadata('@yansha/ui', 'yansha-ui-0.1.0.tgz'),
  '@yansha/platform': makePackageMetadata('@yansha/platform', 'yansha-platform-0.1.0.tgz'),
  '@yansha/contracts': makePackageMetadata('@yansha/contracts', 'yansha-contracts-0.1.0.tgz')
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);

  for (const [pkgName, meta] of Object.entries(packages)) {
    if (meta && (url === '/' + pkgName || url === '/' + encodeURIComponent(pkgName))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(meta));
      return;
    }
  }

  if (url.endsWith('.tgz')) {
    const filename = path.basename(url);
    const filePath = path.join(artifactsDir, filename);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log('Yansha Foundation Local Registry listening on http://127.0.0.1:' + port);
});
