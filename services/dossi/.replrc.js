const child_process = require('child_process');
const fs = require('fs-extra');
const tmpdir = require('tmpdir');

const path = require('path');
const mkdirp = require('mkdirp');

const readResult = async (query) => {
  const result = JSON.parse((await fs.readFile(path.join(tmpdir, query + '.json'), 'utf8')).trim());
  return result;
};

const mkTmp = async () => {
  await mkdirp(tmpdir);
};

const readResultRaw = async (query) => {
  const result = (await fs.readFile(path.join(tmpdir, query + '.json'), 'utf8')).trim();
  return result;
};
async function whatsmyname(username) {
  await mkTmp();
  const dir = process.cwd();
  process.chdir(path.join(process.env.HOME, 'WhatsMyName'));
  const subprocess = child_process.spawn('python3', [path.join(process.env.HOME, 'WhatsMyName', 'web_accounts_list_checker.py'), '-u', username, '-of', path.join(tmpdir, username + '.json') ], { stdio: 'pipe' });
  process.chdir(dir);
  const stdout = await new Promise((resolve, reject) => {
    let data = '';
    subprocess.on('exit', (code) => {
      if (code !== 0) return reject(Error('non-zero exit code'));
      resolve(readResultRaw(username));
    });
  });
  return stdout;
}

