const { ZipArchive } = require('archiver');
const fs = require('fs');

const output = fs.createWriteStream('dist_final.zip');
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.pipe(output);
archive.directory('dist/', false);
archive.finalize();

output.on('close', () => console.log('ZIP criado!'));