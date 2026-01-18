const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const distDir = path.join(rootDir, 'dist');
const outPath = path.join(distDir, 'my-sales-book-kaios.zip');

function resetDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

function buildZip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(appDir, false);
    archive.finalize();
  });
}

resetDist();

buildZip()
  .then(() => {
    console.log(`Created ${outPath}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
