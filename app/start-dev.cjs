const { exec } = require('child_process');
exec('npx next dev -p 3000', (err, stdout, stderr) => {
  if (err) console.error(err);
  console.log(stdout);
});
